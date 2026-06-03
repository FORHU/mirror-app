// Persistent microphone capture for the AI assistant.
//
// The mic is opened ONCE and kept running for the whole standby/listening
// lifetime. Audio is continuously written into a rolling buffer, so there is
// no "dead time" between recordings — the previous design tore the mic down
// after every 2.8s chunk and was deaf for 1–3s while transcription + mic
// re-acquisition happened, which is why the wake word was often missed.

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

// The transcription backend rejects empty / very short PCM with HTTP 422,
// so we never send audio shorter than this.
export const MIN_TRANSCRIBE_MS = 1200;

// Wake loop only transcribes when the recent peak loudness clears this gate, so
// we don't POST silence to the backend every cycle. Kept below the command
// silenceThreshold so we never miss a quietly-spoken wake word.
export const WAKE_VAD_THRESHOLD = 0.012;

// Voice-activity-detection defaults (command capture).
export const VAD = {
  silenceThreshold: 0.015, // normalized RMS below this counts as silence
  silenceMs: 900, // trailing silence that ends an utterance
  maxMs: 8000, // hard cap on a single command
  startTimeoutMs: 4500, // give up if nobody starts speaking
  pollMs: 100,
};

function float32ToInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let n = 0; n < f.length; n++) {
    const c = Math.max(-1, Math.min(1, f[n]));
    out[n] = c < 0 ? c * 0x8000 : c * 0x7fff;
  }
  return out;
}

function combinePcmChunks(chunks: Int16Array[]): ArrayBuffer {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const combined = new Int16Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined.buffer;
}

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });

export class PersistentMic {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private buffer: Int16Array[] = [];
  private bufferSamples = 0;
  private rms: number[] = [];
  private readonly maxSamples: number;
  private starting: Promise<void> | null = null;

  constructor(maxBufferMs = 10000) {
    this.maxSamples = Math.round((maxBufferMs / 1000) * SAMPLE_RATE);
  }

  get active() {
    return !!this.stream;
  }

  /** Open the mic if it isn't already. Idempotent + safe to call concurrently. */
  async start(): Promise<void> {
    if (this.stream) return;
    if (this.starting) return this.starting;

    this.starting = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      if (ctx.state === "suspended") await ctx.resume();
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      const source = ctx.createMediaStreamSource(stream);

      processor.onaudioprocess = (e) => {
        const f = e.inputBuffer.getChannelData(0);
        this.buffer.push(float32ToInt16(f));
        this.bufferSamples += f.length;

        let sum = 0;
        for (let n = 0; n < f.length; n++) sum += f[n] * f[n];
        this.rms.push(Math.sqrt(sum / f.length));
        if (this.rms.length > 64) this.rms.shift();

        while (this.bufferSamples > this.maxSamples && this.buffer.length > 1) {
          this.bufferSamples -= this.buffer.shift()!.length;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      this.stream = stream;
      this.ctx = ctx;
      this.processor = processor;
      this.source = source;
    })();

    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  stop(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
    this.processor = null;
    this.source = null;
    this.clear();
  }

  /** Drop buffered audio (e.g. so we don't transcribe the assistant's own TTS). */
  clear(): void {
    this.buffer = [];
    this.bufferSamples = 0;
    this.rms = [];
  }

  /** Most recent loudness, 0..1. */
  level(): number {
    return this.rms.length ? this.rms[this.rms.length - 1] : 0;
  }

  /** Loudest RMS seen over roughly the last `ms` of audio, 0..1. */
  peakLevel(ms: number): number {
    const blockMs = (BUFFER_SIZE / SAMPLE_RATE) * 1000;
    const n = Math.max(1, Math.ceil(ms / blockMs));
    const recent = this.rms.slice(-n);
    return recent.length ? Math.max(...recent) : 0;
  }

  /** How much audio is currently buffered, in milliseconds. */
  bufferedMs(): number {
    return (this.bufferSamples / SAMPLE_RATE) * 1000;
  }

  /** Snapshot the most recent `ms` of audio as a PCM buffer. */
  tail(ms: number): ArrayBuffer {
    const want = Math.round((ms / 1000) * SAMPLE_RATE);
    const out: Int16Array[] = [];
    let have = 0;
    for (let i = this.buffer.length - 1; i >= 0 && have < want; i--) {
      out.unshift(this.buffer[i]);
      have += this.buffer[i].length;
    }
    return combinePcmChunks(out);
  }
}

/**
 * Capture a single spoken command using silence detection, so short and long
 * commands both come through intact (the old code clipped everything at 5.2s).
 * Resolves with the captured PCM once the speaker stops, or hits the cap.
 */
export async function captureCommand(
  mic: PersistentMic,
  signal?: AbortSignal,
  opts: Partial<typeof VAD> = {},
): Promise<ArrayBuffer> {
  const cfg = { ...VAD, ...opts };
  mic.clear();

  const start = Date.now();
  let speechStarted = false;
  let lastVoice = start;

  for (;;) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    await delay(cfg.pollMs, signal);

    const now = Date.now();
    if (mic.level() > cfg.silenceThreshold) {
      speechStarted = true;
      lastVoice = now;
    }

    if (!speechStarted && now - start > cfg.startTimeoutMs) break;
    if (speechStarted && now - lastVoice > cfg.silenceMs) break;
    if (now - start > cfg.maxMs) break;
  }

  return mic.tail(cfg.maxMs);
}

/** Duration (ms) of a mono Int16 PCM buffer at the capture sample rate. */
export const msOf = (buf: ArrayBuffer) =>
  (buf.byteLength / 2 / SAMPLE_RATE) * 1000;

export { delay };
