import { NextRequest } from "next/server";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  type LanguageCode,
} from "@aws-sdk/client-transcribe-streaming";

export const runtime = "nodejs";

const SUPPORTED_CODES = new Set<string>([
  "en-US",
  "en-GB",
  "en-AU",
  "en-IN",
  "fr-FR",
  "fr-CA",
  "de-DE",
  "es-ES",
  "es-US",
  "it-IT",
  "pt-BR",
  "pt-PT",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "nl-NL",
  "hi-IN",
]);

const LANGUAGE_FALLBACK: Record<string, LanguageCode> = {
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-US",
  it: "it-IT",
  pt: "pt-BR",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  nl: "nl-NL",
  hi: "hi-IN",
};

function resolveLanguageCode(lang: string): LanguageCode {
  if (SUPPORTED_CODES.has(lang)) return lang as LanguageCode;
  const base = lang.split("-")[0];
  return LANGUAGE_FALLBACK[base] ?? "en-US";
}

// 500ms of silence padding (int16 PCM at 16kHz = 16000 samples/s × 0.5s × 2 bytes)
const SILENCE_PADDING = new Uint8Array(16000);

export async function POST(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") ?? "en-US";
  const provider = req.nextUrl.searchParams.get("provider") ?? "aws";

  let audioBytes: Uint8Array;
  try {
    audioBytes = new Uint8Array(await req.arrayBuffer());
  } catch {
    return Response.json({ error: "Failed to read audio body" }, { status: 400 });
  }

  if (audioBytes.length === 0) {
    return Response.json({ transcript: "" });
  }

  // Pad with silence so AWS Transcribe doesn't drop short utterances
  const padded = new Uint8Array(
    SILENCE_PADDING.length + audioBytes.length + SILENCE_PADDING.length,
  );
  padded.set(SILENCE_PADDING, 0);
  padded.set(audioBytes, SILENCE_PADDING.length);
  padded.set(SILENCE_PADDING, SILENCE_PADDING.length + audioBytes.length);

  const client = new TranscribeStreamingClient({
    region: process.env.AWS_REGION ?? "ap-southeast-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  });

  async function* audioStream() {
    const CHUNK = 8192; // 4096 samples × 2 bytes — matches ScriptProcessorNode buffer size
    for (let i = 0; i < padded.length; i += CHUNK) {
      yield { AudioEvent: { AudioChunk: padded.slice(i, i + CHUNK) } };
    }
  }

  try {
    const { TranscriptResultStream } = await client.send(
      new StartStreamTranscriptionCommand({
        LanguageCode: resolveLanguageCode(lang),
        MediaEncoding: "pcm",
        MediaSampleRateHertz: 16000,
        AudioStream: audioStream(),
      }),
    );

    let transcript = "";
    for await (const event of TranscriptResultStream ?? []) {
      for (const result of event.TranscriptEvent?.Transcript?.Results ?? []) {
        if (!result.IsPartial) {
          transcript = result.Alternatives?.[0]?.Transcript ?? transcript;
        }
      }
    }

    return Response.json({ transcript });
  } catch (err) {
    console.error("[transcribe/http]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 500 },
    );
  } finally {
    client.destroy();
  }
}
