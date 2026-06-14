"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import WeatherWidget from "@/components/WeatherWidget";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";

// Single source of truth for the standard kiosk top bar:
//   [ weather ]      [ time / day, date ]      [ optional back / custom ]
// Each page used to re-declare this markup (and its own useClock); they now
// just render <MirrorHeader />.

function ClockDisplay() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <>
        <div
          className="rounded"
          style={{
            width: "80px",
            height: "2rem",
            background: "rgba(255,255,255,0.10)",
          }}
        />
        <div
          className="rounded mt-1"
          style={{
            width: "120px",
            height: "0.875rem",
            background: "rgba(255,255,255,0.07)",
          }}
        />
      </>
    );
  }

  return (
    <>
      <span
        className="text-white font-thin select-none"
        style={{ fontSize: "2rem", lineHeight: 1 }}
      >
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
      <span className="text-white/60 text-sm font-light select-none">
        {now.toLocaleDateString([], { weekday: "long" })},{" "}
        {now.toLocaleDateString([], { month: "long", day: "numeric" })}
      </span>
    </>
  );
}

function CameraIndicator() {
  const isPresent = useMirrorStore((s) => s.isPresent);
  const sensorStatus = useMirrorStore((s) => s.sensorStatus);

  if (sensorStatus === "unavailable" || sensorStatus === "starting") {
    return null;
  }

  const color = isPresent ? "#10b981" : "#f59e0b"; // Green for detected, yellow for searching
  const text = isPresent ? "Detected" : "Scanning";
  const pulse = !isPresent ? "animate-pulse" : "";

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 ${pulse}`}
    >
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span className="text-[9px] uppercase tracking-widest text-white/60">
        {text}
      </span>
    </div>
  );
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
      className={`flex items-center shrink-0 py-4 px-4 ${className}`.trim()}
      style={{ background: "rgba(0,0,0,0.85)", ...style }}
    >
      <div style={{ flex: "0 0 25%", display: "flex", alignItems: "center" }}>
        <WeatherWidget iconSize={iconSize} />
      </div>
      <div
        style={{
          flex: "0 0 50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <ClockDisplay />
      </div>
      <div
        style={{
          flex: "0 0 25%",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <CameraIndicator />
        {rightContent}
      </div>
    </header>
  );
}
