import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are StyleOS, an AI assistant built into a smart mirror kiosk. You help users navigate the app and answer questions about beauty, skincare, and fashion.

Available pages in this app:
- Home / Welcome screen → route: "/"
- Select Gender → route: "/select-gender"
- Virtual Mirror (try on makeup and looks live) → route: "/virtual-mirror"
- AI Cosmetic Recommendation (skin analysis & product picks) → route: "/ai-recommendation-cosmetic"
- AI Fashion Recommendation (outfit suggestions) → route: "/ai-recommendation-fashion"
- Store Map (find nearby cosmetic/fashion stores) → route: "/map"
- Overview / Dashboard → route: "/overview"
- Login / Authentication → route: "/authentication"

When the user asks to navigate, visit, go to, open, or try something that clearly maps to one of those pages, include the route. Otherwise leave route null.

Always respond in this exact JSON format (no markdown, no extra text):
{"reply":"your helpful response here","route":"/the-route-or-null","routeLabel":"Page name or null"}

Keep replies concise, friendly, and kiosk-appropriate (2-3 sentences max).`;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] }: { message: string; history: Message[] } =
      await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 300,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      reply?: string;
      route?: string | null;
      routeLabel?: string | null;
    };

    return NextResponse.json({
      reply: parsed.reply ?? "I'm not sure how to help with that.",
      route: parsed.route && parsed.route !== "null" ? parsed.route : null,
      routeLabel:
        parsed.routeLabel && parsed.routeLabel !== "null"
          ? parsed.routeLabel
          : null,
    });
  } catch (err) {
    console.error("[ai-assistant]", err);
    return NextResponse.json(
      { error: "Failed to get a response" },
      { status: 500 },
    );
  }
}
