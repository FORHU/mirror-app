import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

interface OutfitItem {
  part: string;
  name: string;
}

export async function POST(req: NextRequest) {
  const { referenceImage, outfit } = await req.json() as {
    referenceImage: string;
    outfit: OutfitItem[];
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key missing" }, { status: 400 });
  }
  if (!referenceImage?.startsWith("data:image/")) {
    return NextResponse.json({ error: "Outfit reference image is missing" }, { status: 400 });
  }
  if (!Array.isArray(outfit) || outfit.length === 0) {
    return NextResponse.json({ error: "No clothing items selected" }, { status: 400 });
  }

  const selectedParts = outfit.map(i => `${i.part}: ${i.name}`).join(", ");

  const prompt = [
    "GHOST MANNEQUIN PRODUCT PHOTO — EXACT ITEMS ONLY.",
    "Render ONLY the garments listed below. Do NOT add, invent, or assume any clothing item that is not explicitly listed.",
    "If a body region has no item listed, that region must be completely empty — no substituted clothing, no generic filler garments.",
    "",
    "SELECTED GARMENTS (render these and nothing else):",
    ...outfit.map(i => `  - ${i.part}: ${i.name}`),
    "",
    `Total selected: ${outfit.length} item(s). Render exactly ${outfit.length} item(s). No more.`,
    "",
    "Rendering rules:",
    "Show the garments floating in mid-air as if worn by an invisible standing human body.",
    "The human body is completely invisible — no skin, face, hands, legs, or any body part.",
    "No visible mannequin.",
    "Give each garment realistic 3D volume, natural folds, fabric tension, and hollow openings where the body would be.",
    "Arrange items at their natural body heights based on the reference image.",
    "Do NOT show a flat-lay. Do NOT crop the image.",
    "",
    "Background: solid clean white. Soft studio lighting. Sharp focus.",
    "",
    `Reference items for visual accuracy: ${selectedParts}.`,
  ].join("\n");

  try {
    const client = new OpenAI({ apiKey });
    const buffer = Buffer.from(
      referenceImage.replace(/^data:image\/[^;]+;base64,/, ""),
      "base64"
    );
    const response = await client.images.edit({
      model: "gpt-image-1",
      image: await toFile(buffer, "reference.png", { type: "image/png" }),
      prompt,
      size: "1024x1536",
      quality: "high",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI did not return image data");

    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
