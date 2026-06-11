"use client";

import { useEffect, useRef } from "react";

/**
 * Vertical column that drifts upward continuously. Content is rendered twice
 * (when `loop`) so the wrap from the end back to the start is seamless; any
 * touch/drag/wheel pauses the drift and the user can scroll freely.
 */
export function MarqueeColumn({
  loop,
  children,
  speed = 26,
  resumeDelay = 4500,
  gap = 14,
}: {
  loop: boolean;
  children: React.ReactNode;
  /** Drift speed in px/s. */
  speed?: number;
  /** How long an interaction pauses the drift, in ms. */
  resumeDelay?: number;
  /** Vertical gap between items (and between the looped copies), in px. */
  gap?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !loop) return;
    let raf = 0;
    let last = performance.now();
    // Track the position as a float ourselves: browsers round scrollTop to
    // whole pixels on write (at DPR 1), so feeding sub-pixel increments back
    // through el.scrollTop would round down to 0 and never move.
    let pos = el.scrollTop;
    const tick = (now: number) => {
      // Clamp dt so a backgrounded tab doesn't jump on resume.
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const half = el.scrollHeight / 2;
      if (half > el.clientHeight && Date.now() >= pausedUntilRef.current) {
        // Adopt the browser's position if the user scrolled manually.
        if (Math.abs(el.scrollTop - pos) > 1.5) pos = el.scrollTop;
        pos += speed * dt;
        if (pos >= half) pos -= half;
        el.scrollTop = pos;
      } else {
        pos = el.scrollTop;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop, speed]);

  const pause = () => {
    pausedUntilRef.current = Date.now() + resumeDelay;
  };

  return (
    <div
      ref={ref}
      onPointerDown={pause}
      onTouchStart={pause}
      onWheel={pause}
      className="mirror-scroll h-full"
      style={{
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <div className="flex flex-col" style={{ gap, paddingBottom: gap }}>
        <div className="flex flex-col" style={{ gap }}>
          {children}
        </div>
        {loop && (
          <div className="flex flex-col" style={{ gap }} aria-hidden>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
