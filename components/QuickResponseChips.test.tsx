// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// ── Hoisted mocks — must be declared before vi.mock factories reference them ──
const mockUseVoiceContext = vi.hoisted(() => vi.fn());

vi.mock("@/modules/shared/voice/VoiceProvider", () => ({
  useVoiceContext: mockUseVoiceContext,
}));

// Replace animated wrappers with plain HTML so tests focus on logic, not animation
vi.mock("motion/react", () => {
  function el(tag: string) {
    return function MockEl({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...rest
    }: Record<string, unknown>) {
      return React.createElement(
        tag,
        rest as React.HTMLAttributes<HTMLElement>,
        children as React.ReactNode,
      );
    };
  }
  return {
    motion: { div: el("div"), button: el("button") },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

import {
  QuickResponseChips,
  getToday,
  nextWeekday,
} from "./QuickResponseChips";

// ─────────────────────────────────────────────────────────────────────────────

type VoiceState = {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  submitText: () => Promise<void>;
};

function makeVoice(overrides: Partial<VoiceState> = {}): VoiceState {
  return {
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    submitText: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Fixed anchor: June 9, 2026 = Tuesday (day 2 in getDay())
const ANCHOR = new Date(2026, 5, 9, 12, 0, 0);

const PROMPTS = ["Suggest an outfit for today", "Find nearby restaurants"];

// ─────────────────────────────────────────────────────────────────────────────
// getToday()
// ─────────────────────────────────────────────────────────────────────────────
describe("getToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(ANCHOR);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a non-empty string", () => {
    expect(getToday().length).toBeGreaterThan(0);
  });

  it("includes the current weekday name", () => {
    expect(getToday()).toContain("Tuesday");
  });

  it("includes the current month and day", () => {
    expect(getToday()).toContain("June");
    expect(getToday()).toContain("9");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// nextWeekday()
// ─────────────────────────────────────────────────────────────────────────────
describe("nextWeekday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(ANCHOR);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the correct upcoming Friday (3 days from Tuesday)", () => {
    const result = nextWeekday(5);
    expect(result).toContain("Friday");
    expect(result).toContain("June 12");
  });

  it("returns the correct upcoming Monday (6 days from Tuesday)", () => {
    const result = nextWeekday(1);
    expect(result).toContain("Monday");
    expect(result).toContain("June 15");
  });

  it("returns the correct upcoming Saturday (4 days from Tuesday)", () => {
    const result = nextWeekday(6);
    expect(result).toContain("Saturday");
    expect(result).toContain("June 13");
  });

  it("skips to next week when today IS the target day (Tuesday → June 16 not June 9)", () => {
    const result = nextWeekday(2); // 2 = Tuesday
    expect(result).toContain("Tuesday");
    expect(result).toContain("June 16");
    expect(result).not.toContain("June 9");
  });

  it("never returns today's date for any target day", () => {
    for (let day = 0; day < 7; day++) {
      expect(nextWeekday(day)).not.toContain("June 9");
    }
  });

  it("always returns the correct day-of-week label for every day", () => {
    const names = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    for (let day = 0; day < 7; day++) {
      expect(nextWeekday(day)).toContain(names[day]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QuickResponseChips component
// ─────────────────────────────────────────────────────────────────────────────
describe("QuickResponseChips", () => {
  beforeEach(() => {
    mockUseVoiceContext.mockReturnValue(makeVoice());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all prompt chips when voice is idle", () => {
    render(<QuickResponseChips prompts={PROMPTS} />);
    expect(screen.getByText(PROMPTS[0])).toBeInTheDocument();
    expect(screen.getByText(PROMPTS[1])).toBeInTheDocument();
  });

  it("renders the correct number of chip buttons", () => {
    render(<QuickResponseChips prompts={PROMPTS} />);
    expect(screen.getAllByRole("button")).toHaveLength(PROMPTS.length);
  });

  it("hides all chips when isListening is true", () => {
    mockUseVoiceContext.mockReturnValue(makeVoice({ isListening: true }));
    render(<QuickResponseChips prompts={PROMPTS} />);
    expect(screen.queryByText(PROMPTS[0])).not.toBeInTheDocument();
    expect(screen.queryByText(PROMPTS[1])).not.toBeInTheDocument();
  });

  it("hides all chips when isProcessing is true", () => {
    mockUseVoiceContext.mockReturnValue(makeVoice({ isProcessing: true }));
    render(<QuickResponseChips prompts={PROMPTS} />);
    expect(screen.queryByText(PROMPTS[0])).not.toBeInTheDocument();
  });

  it("hides all chips when isSpeaking is true", () => {
    mockUseVoiceContext.mockReturnValue(makeVoice({ isSpeaking: true }));
    render(<QuickResponseChips prompts={PROMPTS} />);
    expect(screen.queryByText(PROMPTS[0])).not.toBeInTheDocument();
  });

  it("calls submitText with the exact prompt text when a chip is clicked", () => {
    const submitText = vi.fn().mockResolvedValue(undefined);
    mockUseVoiceContext.mockReturnValue(makeVoice({ submitText }));
    render(<QuickResponseChips prompts={PROMPTS} />);
    fireEvent.click(screen.getByText(PROMPTS[0]));
    expect(submitText).toHaveBeenCalledOnce();
    expect(submitText).toHaveBeenCalledWith(PROMPTS[0]);
  });

  it("calls submitText on touchStart — zero-delay touch path", () => {
    const submitText = vi.fn().mockResolvedValue(undefined);
    mockUseVoiceContext.mockReturnValue(makeVoice({ submitText }));
    render(<QuickResponseChips prompts={PROMPTS} />);
    fireEvent.touchStart(screen.getByText(PROMPTS[1]));
    expect(submitText).toHaveBeenCalledOnce();
    expect(submitText).toHaveBeenCalledWith(PROMPTS[1]);
  });
});
