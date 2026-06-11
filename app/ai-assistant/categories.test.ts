import { describe, it, expect } from "vitest";
import { ASSISTANT_CHIP_CATEGORIES } from "./categories";

describe("ASSISTANT_CHIP_CATEGORIES", () => {
  it("does not include a Lifestyle category", () => {
    const labels = ASSISTANT_CHIP_CATEGORIES.map((c) => c.label);
    expect(labels).not.toContain("Lifestyle");
  });

  it("includes exactly Fashion, Skincare, and Places", () => {
    const labels = ASSISTANT_CHIP_CATEGORIES.map((c) => c.label);
    expect(labels).toContain("Fashion");
    expect(labels).toContain("Skincare");
    expect(labels).toContain("Places");
    expect(ASSISTANT_CHIP_CATEGORIES).toHaveLength(3);
  });

  it("each category has exactly 3 prompts", () => {
    for (const category of ASSISTANT_CHIP_CATEGORIES) {
      expect(category.prompts).toHaveLength(3);
    }
  });

  it("no prompt string is empty", () => {
    for (const category of ASSISTANT_CHIP_CATEGORIES) {
      for (const prompt of category.prompts) {
        expect(prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
