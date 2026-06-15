import { NextRequest } from "next/server";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

/**
 * POST /api/mirror/chat-wonder/message
 *
 * Transparent SSE proxy to the backend `POST /api/mirror/chat-wonder/message`.
 * We cannot use Next.js rewrites() for this endpoint because the backend sends
 * a long-lived Server-Sent Events stream, and the Next.js dev-server proxy
 * closes the socket before the stream finishes (ECONNRESET / "socket hang up").
 *
 * This route pipes the backend ReadableStream straight back to the browser with
 * the correct `text/event-stream` headers so the frontend SSE reader works
 * exactly as before — no buffering, no timeout.
 */
export async function POST(req: NextRequest) {
  if (!API_BASE_URL) {
    return new Response(
      JSON.stringify({ error: "ChatWonder backend URL is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Forward auth token from the incoming request if present, otherwise fall
  // back to the kiosk env-var token for the requesting hostname.
  const hostname =
    req.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    req.headers.get("host")?.split(":")[0] ??
    req.nextUrl.hostname;
  const kioskToken =
    hostname === process.env.NEXT_PUBLIC_DOMAIN2
      ? process.env.NEXT_PUBLIC_USER2_ACCESS_TOKEN
      : process.env.NEXT_PUBLIC_USER1_ACCESS_TOKEN;

  const authHeader =
    req.headers.get("Authorization") ??
    (kioskToken ? `Bearer ${kioskToken}` : null);

  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "x-platform": "kiosk",
  };
  if (authHeader) upstreamHeaders.Authorization = authHeader;

  let body: string;
  try {
    body = await req.text();
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to read request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE_URL}/api/mirror/chat-wonder/message`, {
      method: "POST",
      headers: upstreamHeaders,
      body,
      // @ts-expect-error — Node.js fetch supports duplex but TS lib doesn't know it
      duplex: "half",
    });
  } catch (err) {
    console.error("[chat-wonder/message proxy] fetch error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to reach ChatWonder backend" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const upstreamContentType = upstream.headers.get("content-type") ?? "";
  console.log(
    `[chat-wonder/message proxy] upstream status=${upstream.status} content-type="${upstreamContentType}" url=${API_BASE_URL}/api/mirror/chat-wonder/message`,
  );

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    console.error(
      `[chat-wonder/message proxy] upstream error ${upstream.status}:`,
      text,
    );
    return new Response(text || "Upstream error", {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstreamContentType.includes("text/event-stream")) {
    console.error(
      `[chat-wonder/message proxy] upstream returned unexpected content-type "${upstreamContentType}" — expected text/event-stream`,
    );
  }

  // Pipe the upstream ReadableStream straight to the client.
  // This keeps the connection alive for the full duration of the SSE stream
  // without buffering any data in the Next.js layer.
  // Note: Connection header is omitted — it is a hop-by-hop header invalid in HTTP/2.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
