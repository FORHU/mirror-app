import { NextResponse } from "next/server";
import sharp from "sharp";

const MAX_PX = 1500;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Upstream fetch failed" },
        { status: upstream.status },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "image/png";
    const arrayBuf = await upstream.arrayBuffer();

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    };

    // Cap oversized source images while preserving aspect ratio and never upscaling.
    // Garment images with transparent padding must NOT be resized to slot dimensions —
    // the client's getVisibleBounds/drawContained handles placement after full-res load.
    const resized = await sharp(Buffer.from(arrayBuf))
      .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
    return new NextResponse(new Uint8Array(resized), { headers });
  } catch {
    return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
  }
}
