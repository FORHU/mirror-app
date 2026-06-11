import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("BG-20: center empty, swipe columns", () => {
  it("auto-drift marquee is removed", () => {
    expect(src).not.toContain("MARQUEE_SPEED");
    expect(src).not.toContain("requestAnimationFrame");
  });

  it("scroll-snap swiping is applied to product columns", () => {
    expect(src).toContain("scrollSnapType");
    expect(src).toContain("scrollSnapAlign");
  });

  it("center product-detail panel is removed", () => {
    expect(src).not.toContain("Close product view");
    expect(src).not.toContain("bg-black border border-white/10");
  });
});
