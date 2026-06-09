"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import WeatherWidget from "@/components/WeatherWidget";
import { LanguageSelector } from "@/components/LanguageSelector";

// Single source of truth for the standard kiosk top bar:
//   [ weather ]      [ time / day, date ]      [ optional back / custom ]
// Each page used to re-declare this markup (and its own useClock); they now
// just render <MirrorHeader />.

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Wrap the initial state update in a timeout to avoid the synchronous setState warning
    const timeoutId = setTimeout(() => setNow(new Date()), 0);
    const intervalId = setInterval(() => setNow(new Date()), 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);
  return now;
}

export interface MirrorHeaderProps {
  /** Show a back arrow on the right; called when tapped. */
  onBack?: () => void;
  /** Custom right-side content. Overrides the back button when provided. */
  right?: ReactNode;
  /** Weather icon size (default 32). */
  iconSize?: number;
  /** Extra classes appended to the <header>. */
  className?: string;
  /** Inline style overrides for the <header> (e.g. a different background). */
  style?: React.CSSProperties;
}

export default function MirrorHeader({
  onBack,
  right,
  iconSize = 32,
  className = "",
  style,
}: MirrorHeaderProps) {
  const now = useClock();
  const time = now
    ? now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const day = now ? now.toLocaleDateString([], { weekday: "long" }) : "";
  const date = now
    ? now.toLocaleDateString([], { month: "long", day: "numeric" })
    : "";

  const rightContent =
    right ??
    (onBack ? (
      <button
        onClick={onBack}
        aria-label="Back"
        className="p-4 transition-all hover:scale-105 active:scale-95"
      >
        <ArrowLeft className="w-6 h-6 text-white" />
      </button>
    ) : null);

  return (
    <header
      className={`grid items-center shrink-0 py-4 px-5 ${className}`.trim()}
      style={{
        gridTemplateColumns: "1fr auto 1fr",
        background: "rgba(0,0,0,0.85)",
        ...style,
      }}
    >
      {/* Left — weather */}
      <div className="flex items-center">
        <WeatherWidget iconSize={iconSize} />
      </div>

      {/* Center — clock, always truly centered */}
      <div className="flex flex-col items-center">
        <span
          className="text-white font-thin select-none"
          style={{ fontSize: "2rem", lineHeight: 1 }}
        >
          {time}
        </span>
        <span className="text-white/60 text-sm font-light select-none">
          {day}, {date}
        </span>
      </div>

      {/* Right — custom slot + language selector */}
      <div className="flex items-center justify-end gap-3 min-w-0">
        {rightContent}
        <LanguageSelector />
      </div>
    </header>
  );
}
