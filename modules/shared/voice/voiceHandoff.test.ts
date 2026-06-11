import { describe, it, expect } from "vitest";
import {
  isFashionHandoffPrompt,
  isCosmeticHandoffPrompt,
  isMapDiscoveryPrompt,
  isLifestylePrompt,
} from "./voiceHandoff";

describe("isFashionHandoffPrompt", () => {
  it.each([
    "What should I wear today?",
    "Suggest me an outfit for the weekend",
    "Give me a full look for tonight",
    "What's the best clothing for a date?",
    "I need a complete look for my meeting",
    "Recommend an outfit for the party",
    "Dress me for summer",
    "Show me wardrobe options",
  ])("returns true for: %s", (text) => {
    expect(isFashionHandoffPrompt(text)).toBe(true);
  });

  it.each([
    "What foundation should I use?",
    "Show me restaurants near me",
    "Tell me a joke",
  ])("returns false for: %s", (text) => {
    expect(isFashionHandoffPrompt(text)).toBe(false);
  });
});

describe("isCosmeticHandoffPrompt", () => {
  it.each([
    "Recommend a moisturizer for dry skin",
    "What skincare routine should I follow?",
    "I need a good sunscreen",
    "Suggest a serum for glowing skin",
    "What foundation matches my skin tone?",
  ])("returns true for: %s", (text) => {
    expect(isCosmeticHandoffPrompt(text)).toBe(true);
  });

  it.each([
    "What should I wear today?",
    "Show me places near me",
    "What's the weather like?",
  ])("returns false for: %s", (text) => {
    expect(isCosmeticHandoffPrompt(text)).toBe(false);
  });
});

describe("isMapDiscoveryPrompt", () => {
  it.each([
    "What are things to do near me?",
    "Suggest a nice place to visit",
    "Where can I go this weekend?",
    "Find me a fun spot nearby",
    "Plan my full route for today",
    "Show me good places around here",
  ])("returns true for: %s", (text) => {
    expect(isMapDiscoveryPrompt(text)).toBe(true);
  });

  it.each([
    "What should I wear?",
    "Recommend a moisturizer",
    "Tell me about fashion trends",
  ])("returns false for: %s", (text) => {
    expect(isMapDiscoveryPrompt(text)).toBe(false);
  });
});

describe("isLifestylePrompt", () => {
  // All 6 chip prompts from the Lifestyle tab
  it.each([
    "I want a complete daily glow-up plan — outfit, skincare, and somewhere to go today.",
    "Help me plan my day: what to wear, how to care for my skin, and where to go.",
    'I want a "clean girl aesthetic" day — outfit, skincare, and place suggestions.',
    "Give me a weekend-ready outfit and a place I should visit.",
    "What should I wear and how should I care for my skin in hot weather?",
    "I want a lazy day look — comfy but still stylish, plus somewhere chill to go.",
  ])("returns true for lifestyle chip: %s", (text) => {
    expect(isLifestylePrompt(text)).toBe(true);
  });

  // Single-domain prompts should NOT trigger lifestyle routing
  it.each([
    "What should I wear today?",
    "Recommend a moisturizer for dry skin",
    "Show me restaurants near me",
    "What foundation matches my skin tone?",
    "Find me a fun spot nearby",
    "Give me outfit ideas for a party",
    "What skincare routine should I follow?",
  ])("returns false for single-domain: %s", (text) => {
    expect(isLifestylePrompt(text)).toBe(false);
  });
});
