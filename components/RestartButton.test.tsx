// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockPerformRestart = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("@/modules/shared/voice/sessionCommands", () => ({
  performRestart: mockPerformRestart,
}));

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

import RestartButton from "./RestartButton";

// ─────────────────────────────────────────────────────────────────────────────
describe("RestartButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformRestart.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a button with 'New Session' label", () => {
    render(<RestartButton />);
    expect(
      screen.getByRole("button", { name: /new session/i }),
    ).toBeInTheDocument();
  });

  it("calls performRestart when clicked", () => {
    render(<RestartButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockPerformRestart).toHaveBeenCalledOnce();
  });

  it("calls performRestart on touchStart — zero-delay touch path", () => {
    render(<RestartButton />);
    fireEvent.touchStart(screen.getByRole("button"));
    expect(mockPerformRestart).toHaveBeenCalledOnce();
  });

  it("passes the router instance to performRestart", () => {
    render(<RestartButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockPerformRestart).toHaveBeenCalledWith(mockRouter);
  });

  it("does not propagate errors when performRestart rejects", () => {
    mockPerformRestart.mockRejectedValueOnce(new Error("network error"));
    render(<RestartButton />);
    expect(() => fireEvent.click(screen.getByRole("button"))).not.toThrow();
  });
});
