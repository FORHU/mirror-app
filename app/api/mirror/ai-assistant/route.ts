import { NextRequest, NextResponse } from "next/server";
import { SITEMAP_CONTEXT } from "@/navigation";
import { resolveNav } from "@/lib/navResolver";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

function resolveAccessToken(req: NextRequest) {
  const hostname = req.nextUrl.hostname;
  if (hostname === process.env.NEXT_PUBLIC_DOMAIN2) {
    return process.env.NEXT_PUBLIC_USER2_ACCESS_TOKEN ?? null;
  }
  return process.env.NEXT_PUBLIC_USER1_ACCESS_TOKEN ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const { message }: { message: string; history?: unknown[] } =
      await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    // Navigation short-circuit: resolve "[nav]" / "go to X" requests against the
    // app's real routes here, deterministically, instead of relying on the
    // ChatWonder styling agent (which doesn't understand navigation). Returns the
    // same { reply, route, routeLabel } shape the client already handles, so
    // page.tsx will speak the reply then router.push(route).
    const nav = resolveNav(message);
    if (nav) {
      return NextResponse.json({
        reply: `Sure — opening ${nav.label}.`,
        route: nav.target_url,
        routeLabel: "Open page",
      });
    }

    if (!API_BASE_URL) {
      return NextResponse.json(
        { error: "ChatWonder backend URL is not configured" },
        { status: 500 },
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-platform": "kiosk",
    };

    const token = resolveAccessToken(req);
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/api/mirror/chat-wonder/message`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: message.trim(),
        sitemap_context: SITEMAP_CONTEXT,
      }),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || json?.status !== "success") {
      return NextResponse.json(
        { error: json?.message ?? "Failed to get a ChatWonder response" },
        { status: response.status || 500 },
      );
    }

    const data = json.data ?? {};
    const targetUrl =
      typeof data.nav_data?.target_url === "string"
        ? data.nav_data.target_url
        : null;

    return NextResponse.json({
      reply: data.message ?? "I'm not sure how to help with that.",
      route: targetUrl,
      routeLabel: targetUrl ? "Open page" : null,
    });
  } catch (err) {
    console.error("[ai-assistant]", err);
    return NextResponse.json(
      { error: "Failed to get a ChatWonder response" },
      { status: 500 },
    );
  }
}
