import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "page.tsx"), "utf-8");

// Slice just the garment slot cards block so we don't catch other card styles
const slotSection = src.slice(
  src.indexOf("{/* Garment slot cards */}"),
  src.indexOf("{/* Loading state", src.indexOf("{/* Garment slot cards */}")),
);

describe("BG-3: garment slot card title and description not cut off", () => {
  it("name uses a smaller font (11px or less)", () => {
    // Was 12px — should be reduced
    expect(slotSection).not.toMatch(/fontSize:\s*"12px"/);
  });

  it("name is clamped so it does not push description out of view", () => {
    expect(slotSection).toContain("WebkitLineClamp");
  });

  it("description uses a smaller font (9px or less)", () => {
    // Was 10px — should be reduced to give more room
    expect(slotSection).not.toMatch(/fontSize:\s*"10px"/);
  });
});
