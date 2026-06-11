import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "page.tsx"), "utf-8");

describe("BG-23: fashion suggestions are short and general", () => {
  it("has 6 or fewer suggestion prompts", () => {
    // Count lines inside the prompts array passed to PromptFloater
    const floaterBlock = src.slice(
      src.indexOf("<PromptFloater"),
      src.indexOf("/>", src.indexOf("<PromptFloater")) + 2,
    );
    const promptLines = (floaterBlock.match(/^\s+"[^"]+",/gm) ?? []).length;
    expect(promptLines).toBeLessThanOrEqual(6);
  });
});
