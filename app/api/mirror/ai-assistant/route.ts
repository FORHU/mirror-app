import { NextRequest, NextResponse } from "next/server";
import { ROUTES, SITEMAP_CONTEXT } from "@/navigation";
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

const EVENT_HINT =
  /\b(meeting|date|dinner|lunch|breakfast|event|appointment|interview|party|wedding|class|conference|presentation|trip|travel|visit|commute|errand)\b/i;
const TIME_HINT =
  /\b(today|tonight|tomorrow|morning|afternoon|evening|later|this\s+(morning|afternoon|evening|weekend)|next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|weekend)|\d{1,2}(:\d{2})?\s*(am|pm))\b/i;
const PLACE_HINT = /\b(in|at|near|around|to)\s+[a-z][a-z0-9 .'-]{2,}\b/i;
const PERSONAL_PLAN_HINT =
  /\b(i\s+(will|have|got|am|need|plan|want)|i'm|im|going|headed|heading|attending|attend|visiting|visit|traveling|travelling)\b/i;
const PREP_HINT =
  /\b(wear|outfit|clothes|clothing|dress|style|prepare|recommend|suggest|weather|bring|route|directions|navigate)\b/i;

function resolveOverviewHandoff(rawInput: string) {
  const input = rawInput.trim();
  const hasEvent = EVENT_HINT.test(input);
  const hasTime = TIME_HINT.test(input);
  const hasPlace = PLACE_HINT.test(input);
  const hasPersonalPlan = PERSONAL_PLAN_HINT.test(input);
  const hasPrepNeed = PREP_HINT.test(input);

  if (
    (hasPersonalPlan && hasEvent && (hasTime || hasPlace)) ||
    (hasPrepNeed && hasPlace && (hasTime || hasEvent))
  ) {
    return {
      reply:
        "Opening Overview so I can pull together the map, weather, and outfit context.",
      route: ROUTES.OVERVIEW,
      routeLabel: "Open overview",
    };
  }

  return null;
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

    // Situation/prep prompts belong on /overview, where the existing handoff
    // replays the original prompt through ChatWonder's streaming tool pipeline.
    const overview = resolveOverviewHandoff(message);
    if (overview) {
      return NextResponse.json(overview);
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

    const response = await fetch(
      `${API_BASE_URL}/api/mirror/chat-wonder/message`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: message.trim(),
          sitemap_context: SITEMAP_CONTEXT,
        }),
      },
    );

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
