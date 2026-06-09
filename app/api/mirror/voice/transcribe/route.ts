import { NextRequest } from "next/server";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

export async function POST(req: NextRequest) {
  if (!API_BASE_URL) {
    return new Response(
      JSON.stringify({ error: "Backend URL not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const hostname = req.nextUrl.hostname;
  const kioskToken =
    hostname === process.env.NEXT_PUBLIC_DOMAIN2
      ? process.env.NEXT_PUBLIC_USER2_ACCESS_TOKEN
      : process.env.NEXT_PUBLIC_USER1_ACCESS_TOKEN;

  const authHeader =
    req.headers.get("Authorization") ??
    (kioskToken ? `Bearer ${kioskToken}` : null);

  const lang = req.nextUrl.searchParams.get("lang") ?? "en-US";

  let body: ArrayBuffer;
  try {
    body = await req.arrayBuffer();
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to read audio body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "x-platform": "kiosk",
  };
  if (authHeader) upstreamHeaders.Authorization = authHeader;

  let upstream: Response;
  try {
    upstream = await fetch(
      `${API_BASE_URL}/api/mirror/voice/transcribe?lang=${encodeURIComponent(lang)}`,
      { method: "POST", headers: upstreamHeaders, body },
    );
  } catch (err) {
    console.error("[voice/transcribe proxy]", err);
    return new Response(
      JSON.stringify({ error: "Failed to reach transcription backend" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
