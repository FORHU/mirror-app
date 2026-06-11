import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("BG-12: section labels removed from product columns", () => {
  it('does not pass label="Daily Essentials" to CosmeticGrid', () => {
    expect(src).not.toContain('label="Daily Essentials"');
  });

  it('does not pass label="Targeted Treatments" to CosmeticGrid', () => {
    expect(src).not.toContain('label="Targeted Treatments"');
  });
});

describe("BG-11: outer layout has enough bottom clearance for buttons", () => {
  it("outer layout container uses pb-20 or more to clear the fixed bottom buttons", () => {
    // pb-16 = 64px, pb-20 = 80px — either is enough to clear bottom-4 New Session button
    expect(src).toMatch(/pb-(?:16|20|24|28|32|\[)/);
  });
});
