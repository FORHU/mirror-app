"use client";

import { useEffect, useState } from "react";

export interface Quote {
  text: string;
  author: string;
}

interface QuoteCarouselProps {
  quotes: Quote[];
  /** Small uppercase eyebrow shown above the quote (e.g. "Skin Tip"). */
  label?: string;
  /** ms between quote changes. */
  intervalMs?: number;
  /** ms for the fade-out/in transition. */
  fadeMs?: number;
  /** Classes for the outer container (layout, padding, border, etc.). */
  className?: string;
  /** Classes for the eyebrow label color (e.g. "text-pink-300/40"). */
  labelClassName?: string;
}

/**
 * Cycles through a list of quotes with a fade transition. Owns its own
 * timer/visibility state, so the parent only needs to mount it when the
 * quote view should be on screen.
 */
export function QuoteCarousel({
  quotes,
  label = "Tip",
  intervalMs = 4000,
  fadeMs = 600,
  className = "",
  labelClassName = "text-white/20",
}: QuoteCarouselProps) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (quotes.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % quotes.length);
        setVisible(true);
      }, fadeMs);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [quotes.length, intervalMs, fadeMs]);

  if (!quotes.length) return null;
  const quote = quotes[idx % quotes.length];

  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${fadeMs / 1000}s ease`,
      }}
    >
      <p
        className={`text-[9px] uppercase tracking-[0.22em] mb-5 ${labelClassName}`}
      >
        {label}
      </p>
      <p className="text-[17px] font-light italic leading-relaxed text-white/85 mb-4">
        &ldquo;{quote.text}&rdquo;
      </p>
      <p className="text-[11px] text-white/30 tracking-wide">
        — {quote.author}
      </p>
    </div>
  );
}
