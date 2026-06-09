export function concatFrames(frames: Float32Array[]): Float32Array {
  const totalLength = frames.reduce((n, f) => n + f.length, 0);
  const combined = new Float32Array(totalLength);
  let offset = 0;
  for (const f of frames) {
    combined.set(f, offset);
    offset += f.length;
  }
  return combined;
}

export function float32ToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function transcribeAudio(opts: {
  int16: Int16Array;
  lang: string;
  token: string | null;
}): Promise<string> {
  const { int16, lang, token } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(
    `/api/mirror/voice/transcribe?lang=${encodeURIComponent(lang)}`,
    { method: "POST", headers, body: int16.buffer as ArrayBuffer },
  );

  if (!res.ok) {
    const { error } = (await res
      .json()
      .catch(() => ({ error: "Transcription failed" }))) as { error: string };
    throw new Error(error);
  }

  const { transcript } = (await res.json()) as { transcript: string };
  return transcript ?? "";
}
