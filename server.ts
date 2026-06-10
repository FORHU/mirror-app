import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, type WebSocket, type RawData } from "ws";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  type LanguageCode,
} from "@aws-sdk/client-transcribe-streaming";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3001", 10);
const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

// AWS Transcribe supports a specific set of language codes
const SUPPORTED_TRANSCRIBE_CODES = new Set<string>([
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
  if (SUPPORTED_TRANSCRIBE_CODES.has(lang)) return lang as LanguageCode;
  const base = lang.split("-")[0];
  return LANGUAGE_FALLBACK[base] ?? "en-US";
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    await handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "");
    if (pathname === "/api/mirror/voice/transcribe-ws") {
      wss.handleUpgrade(req, socket as never, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      // Let Next.js handle its own WebSocket upgrades (e.g. HMR)
      // by not destroying the socket here
    }
  });

  wss.on("connection", async (ws: WebSocket, req: { url?: string }) => {
    const qs = (req.url ?? "").split("?")[1] ?? "";
    const lang = new URLSearchParams(qs).get("lang") ?? "en-US";
    const languageCode = resolveLanguageCode(lang);

    const client = new TranscribeStreamingClient({
      region: process.env.AWS_REGION ?? "ap-southeast-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });

    const audioQueue: Uint8Array[] = [];
    let audioEnded = false;
    let notifyChunk: (() => void) | null = null;

    ws.on("message", (data: RawData) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

      // Control messages are JSON (starts with '{')
      if (buf[0] === 0x7b) {
        try {
          const msg = JSON.parse(buf.toString()) as { type?: string };
          if (msg.type === "end") {
            audioEnded = true;
            notifyChunk?.();
            notifyChunk = null;
          }
        } catch {
          /* ignore malformed JSON */
        }
        return;
      }

      // Binary PCM audio chunk
      audioQueue.push(new Uint8Array(buf));
      notifyChunk?.();
      notifyChunk = null;
    });

    ws.on("close", () => {
      audioEnded = true;
      notifyChunk?.();
      notifyChunk = null;
    });

    async function* audioStream() {
      while (!audioEnded || audioQueue.length > 0) {
        while (audioQueue.length > 0) {
          yield { AudioEvent: { AudioChunk: audioQueue.shift()! } };
        }
        if (!audioEnded) {
          await new Promise<void>((resolve) => {
            notifyChunk = resolve;
          });
        }
      }
    }

    const safeSend = (payload: string) => {
      try {
        if (ws.readyState === ws.OPEN) ws.send(payload);
      } catch {
        /* connection closed */
      }
    };

    try {
      const command = new StartStreamTranscriptionCommand({
        LanguageCode: languageCode,
        MediaEncoding: "pcm",
        MediaSampleRateHertz: 16000,
        AudioStream: audioStream(),
      });

      const { TranscriptResultStream } = await client.send(command);

      for await (const event of TranscriptResultStream ?? []) {
        const results = event.TranscriptEvent?.Transcript?.Results ?? [];
        for (const result of results) {
          const text = result.Alternatives?.[0]?.Transcript ?? "";
          if (!text) continue;
          safeSend(
            JSON.stringify({
              type: result.IsPartial ? "partial" : "final",
              transcript: text,
            }),
          );
        }
      }

      safeSend(JSON.stringify({ type: "done" }));
    } catch (err) {
      console.error("[transcribe-ws]", err);
      safeSend(
        JSON.stringify({
          type: "error",
          message: err instanceof Error ? err.message : "Transcription failed",
        }),
      );
    } finally {
      client.destroy();
    }
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://0.0.0.0:${port}`);
  });
});
