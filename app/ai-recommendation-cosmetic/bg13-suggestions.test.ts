import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("BG-13: skincare suggestions are short 1-liners", () => {
  it("each suggestion prompt is under 60 characters", () => {
    const floaterBlock = src.slice(
      src.indexOf("<PromptFloater"),
      src.indexOf("/>", src.indexOf("<PromptFloater")) + 2,
    );
    // Extract all string literals inside the prompts array
    const promptLines = floaterBlock.match(/`[^`]+`|"[^"]+"/g) ?? [];
    // Filter to actual prompt strings (not prop names or short attribute values)
    const prompts = promptLines.filter((s) => s.length > 15);
    expect(prompts.length).toBeGreaterThan(0);
    for (const prompt of prompts) {
      // Strip template literal ticks/quotes and evaluate length
      const text = prompt.replace(/^[`"']|[`"']$/g, "");
      expect(text.length, `prompt too long: "${text}"`).toBeLessThanOrEqual(60);
    }
  });
});
