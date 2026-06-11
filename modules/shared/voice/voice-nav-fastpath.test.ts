import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { isNavigationPhrase } from "@/modules/map/utils/chatWonderMapUtils";

const src = readFileSync(
  join(__dirname, "VoiceProvider.tsx"),
  "utf-8",
);

// The new fast-path block sits before the 4 existing semantic fast-paths.
// Slice it out so assertions don't bleed into unrelated code.
const fastPathBlock = src.slice(
  src.indexOf("if (isNavigationPhrase(t)) {"),
  src.indexOf("if (isLifestylePrompt(t)"),
);

// The 4 existing semantic fast-paths (after the navigation block).
const semanticPaths = src.slice(
  src.indexOf("if (isLifestylePrompt(t)"),
  src.indexOf("const history = historyRef.current"),
);

describe("voice latency fix: isNavigationPhrase correctly classifies the failing phrase", () => {
  it('"Navigate me to Maps" is a navigation phrase (was missing from regex — root cause of 20s bug)', () => {
    expect(isNavigationPhrase("Navigate me to Maps")).toBe(true);
  });

  it('"go to the map" is a navigation phrase', () => {
    expect(isNavigationPhrase("go to the map")).toBe(true);
  });

  it('"take me to fashion" is a navigation phrase', () => {
    expect(isNavigationPhrase("take me to fashion")).toBe(true);
  });

  it('"navigate to cosmetics" is a navigation phrase', () => {
    expect(isNavigationPhrase("navigate to cosmetics")).toBe(true);
  });
});

describe("voice latency fix: new navigation fast-path block exists in handleAIAssistantText", () => {
  it("fast-path block is present before existing semantic fast-paths", () => {
    expect(fastPathBlock.length).toBeGreaterThan(0);
  });

  it("fast-path resolves map destination", () => {
    expect(fastPathBlock).toMatch(/\\bmap\(s\)\?\\b/);
  });

  it("fast-path resolves fashion destination", () => {
    expect(fastPathBlock).toMatch(/fashion|outfit/i);
  });

  it("fast-path resolves cosmetics destination", () => {
    expect(fastPathBlock).toMatch(/cosmetic|skincare/i);
  });

  it("fast-path resolves overview destination", () => {
    expect(fastPathBlock).toMatch(/overview|home/i);
  });

  it("fast-path awaits speakText before router.push", () => {
    const speakIdx = fastPathBlock.indexOf("await speakText(assistantReply)");
    const pushIdx = fastPathBlock.indexOf("router.push(target)");
    expect(speakIdx).toBeGreaterThan(-1);
    expect(pushIdx).toBeGreaterThan(-1);
    expect(speakIdx).toBeLessThan(pushIdx);
  });

  it("unknown destination falls through to AI API (no early return)", () => {
    expect(fastPathBlock).toContain("// Unknown destination — fall through to the AI API");
  });

  it("does NOT write to sessionStorage — navigation phrases are not meaningful queries for target pages", () => {
    // The 4 semantic fast-paths DO write to session storage (transcript is a real query).
    // The navigation fast-path must NOT — "Navigate me to Maps" would cause the
    // map/fashion/cosmetics page to auto-run it as an AI query on mount.
    expect(fastPathBlock).not.toContain("sessionStorage.setItem");
  });
});

describe("voice latency fix: all 4 existing semantic fast-paths speak before navigating", () => {
  function assertSpeakBeforePush(pathSrc: string, label: string) {
    const speakIdx = pathSrc.indexOf("await speakText(assistantReply)");
    const pushIdx = pathSrc.indexOf("router.push(");
    expect(speakIdx, `${label}: speakText not found`).toBeGreaterThan(-1);
    expect(pushIdx, `${label}: router.push not found`).toBeGreaterThan(-1);
    expect(speakIdx, `${label}: speakText must come before router.push`).toBeLessThan(pushIdx);
  }

  it("lifestyle fast-path speaks before navigating", () => {
    const block = semanticPaths.slice(
      semanticPaths.indexOf("if (isLifestylePrompt(t)"),
      semanticPaths.indexOf("if (isFashionHandoffPrompt(t)"),
    );
    assertSpeakBeforePush(block, "lifestyle");
  });

  it("fashion fast-path speaks before navigating", () => {
    const block = semanticPaths.slice(
      semanticPaths.indexOf("if (isFashionHandoffPrompt(t)"),
      semanticPaths.indexOf("const alreadyOnMap"),
    );
    assertSpeakBeforePush(block, "fashion");
  });

  it("map discovery fast-path speaks before navigating", () => {
    const block = semanticPaths.slice(
      semanticPaths.indexOf("if (isMapDiscoveryPrompt(t)"),
      semanticPaths.indexOf("if (isCosmeticHandoffPrompt(t)"),
    );
    assertSpeakBeforePush(block, "map discovery");
  });

  it("cosmetics fast-path speaks before navigating", () => {
    const block = semanticPaths.slice(
      semanticPaths.indexOf("if (isCosmeticHandoffPrompt(t)"),
      semanticPaths.indexOf("const history = historyRef.current"),
    );
    assertSpeakBeforePush(block, "cosmetics");
  });
});

describe("voice latency fix: useCallback dependency array includes speakText", () => {
  it("handleAIAssistantText deps include speakText", () => {
    // Find the closing deps array of handleAIAssistantText
    expect(src).toContain("[router, stopPlayback, speakText]");
  });
});
