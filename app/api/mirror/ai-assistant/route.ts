import { NextRequest, NextResponse } from "next/server";
import { ROUTES, SITEMAP_CONTEXT, isKnownRoute } from "@/navigation";

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
          // Tag as [stylist] so the backend selects the Mirror Stylist persona,
          // which emits the canonical [STYLIST]{target_url} navigation block.
          input: `[stylist] ${message.trim()}`,
          sitemap_context: SITEMAP_CONTEXT,
        }),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get a ChatWonder response" },
        { status: response.status || 500 },
      );
    }

    if (!response.body) {
      return NextResponse.json({ error: "Empty response body" }, { status: 500 });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalJson: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === "complete") {
              finalJson = parsed;
            } else if (parsed.type === "error") {
              throw new Error(parsed.message || "Stream error");
            }
          } catch (e) {
            // ignore partial or non-json
          }
        }
      }
    }

    if (!finalJson) {
      return NextResponse.json({ error: "Stream ended without complete payload" }, { status: 500 });
    }

    const data = finalJson ?? {};
    // Canonical nav block. `stylist_data` already prefers [STYLIST] and folds in
    // the legacy [NAV_DATA] fallback server-side, so we read a single field.
    const rawTarget =
      typeof data.stylist_data?.target_url === "string"
        ? data.stylist_data.target_url
        : null;
    // Special session gestures handled client-side (not pushable routes).
    const command =
      rawTarget === "restart" || rawTarget === "refresh" ? rawTarget : null;
    // "back" is a client-only gesture (router.back); not a pushable route on the
    // landing screen. Also ignore stale targets that aren't real app routes.
    const targetUrl =
      rawTarget && !command && rawTarget !== "back" && isKnownRoute(rawTarget)
        ? rawTarget
        : null;

    // When the response carries a navigation gesture, speak its system_message
    // ("Navigating to the fashion section.") rather than any raw reply text.
    const systemMessage =
      typeof data.stylist_data?.system_message === "string"
        ? data.stylist_data.system_message
        : null;
    const reply =
      (rawTarget && systemMessage) ||
      data.message ||
      "I'm not sure how to help with that.";

    return NextResponse.json({
      reply,
      route: targetUrl,
      routeLabel: targetUrl ? "Open page" : null,
      command,
    });
  } catch (err) {
    console.error("[ai-assistant]", err);
    return NextResponse.json(
      { error: "Failed to get a ChatWonder response" },
      { status: 500 },
    );
  }
}
