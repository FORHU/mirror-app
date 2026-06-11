import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("BG-17: Skin Types button alignment", () => {
  it("button does not use bottom-[104px]", () => {
    expect(src).not.toContain("bottom-[104px]");
  });

  it("button is anchored at bottom-4 to align with New Session button", () => {
    // aria-label is on the same element — its className must include bottom-4
    const match = src.match(
      /aria-label="Browse products by skin type"[^>]*className="([^"]*)"/,
    );
    expect(match).not.toBeNull();
    expect(match![1]).toContain("bottom-4");
  });
});
