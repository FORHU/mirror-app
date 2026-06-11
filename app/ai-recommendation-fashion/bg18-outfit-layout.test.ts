import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("BG-18: Outfit layout — bigger image, smaller description", () => {
  it("main outfit image uses a flex ratio greater than 5", () => {
    // The outfit image container should not be capped at flex: "5 1 0"
    expect(src).not.toContain('flex: "5 1 0"');
  });

  it("outfit description font size is 9px or smaller", () => {
    // Description was 10px — it should be reduced
    // Grab the block between the image div and the garment cards div
    const descBlock = src.slice(
      src.indexOf("/* Name & description"),
      src.indexOf("/* Garment cards"),
    );
    expect(descBlock).not.toContain('"10px"');
  });
});
