import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "GarmentSelectionPanel.tsx"), "utf-8");

describe("BG-22: garment panel closed state", () => {
  it("does not render tilted/rotated Garments text", () => {
    expect(src).not.toContain("vertical-rl");
    expect(src).not.toContain("rotate(180deg)");
  });

  it("shirt icon is at least h-8 w-8", () => {
    // h-4 w-4 was the old small size
    expect(src).not.toContain('<Shirt className="h-4 w-4"');
    expect(src).toMatch(/<Shirt className="h-[89]|h-1[0-9]/);
  });
});
