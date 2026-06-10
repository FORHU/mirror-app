import { NextRequest } from "next/server";
import {
  PollyClient,
  SynthesizeSpeechCommand,
  VoiceId,
  Engine,
  OutputFormat,
} from "@aws-sdk/client-polly";

export const runtime = "nodejs";

// Neural voices available in ap-southeast-1 (Singapore)
// https://docs.aws.amazon.com/polly/latest/dg/available-voices.html
const VOICE_MAP: Record<string, { id: VoiceId; neural: boolean }> = {
  "en-US": { id: VoiceId.Joanna, neural: true },
  "en-GB": { id: VoiceId.Amy, neural: true },
  "en-AU": { id: VoiceId.Olivia, neural: true },
  "en-IN": { id: VoiceId.Aditi, neural: false }, // Aditi = standard only
  "fr-FR": { id: VoiceId.Lea, neural: true },
  "fr-CA": { id: VoiceId.Gabrielle, neural: true },
  "de-DE": { id: VoiceId.Vicki, neural: true },
  "es-ES": { id: VoiceId.Lucia, neural: true },
  "es-US": { id: VoiceId.Lupe, neural: true },
  "it-IT": { id: VoiceId.Bianca, neural: true },
  "pt-BR": { id: VoiceId.Camila, neural: true },
  "pt-PT": { id: VoiceId.Ines, neural: true },
  "ja-JP": { id: VoiceId.Takumi, neural: true },
  "ko-KR": { id: VoiceId.Seoyeon, neural: true },
  "zh-CN": { id: VoiceId.Zhiyu, neural: true },
  "nl-NL": { id: VoiceId.Laura, neural: true },
  "ar-AE": { id: VoiceId.Hala, neural: true },
};

const polly = new PollyClient({
  region: process.env.AWS_REGION ?? "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

export async function POST(req: NextRequest) {
  let text: string;
  let lang: string;
  try {
    const body = (await req.json()) as { text?: string; lang?: string };
    text = (body.text ?? "").trim();
    lang = body.lang ?? "en-US";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!text) {
    return Response.json({ error: "No text provided" }, { status: 400 });
  }

  const voice = VOICE_MAP[lang] ?? VOICE_MAP["en-US"]!;

  try {
    const { AudioStream, ContentType } = await polly.send(
      new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: OutputFormat.MP3,
        VoiceId: voice.id,
        Engine: voice.neural ? Engine.NEURAL : Engine.STANDARD,
      }),
    );

    if (!AudioStream) {
      return Response.json({ error: "No audio stream from Polly" }, { status: 500 });
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of AudioStream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      headers: {
        "Content-Type": ContentType ?? "audio/mpeg",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[polly/tts]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "TTS synthesis failed" },
      { status: 500 },
    );
  }
}
