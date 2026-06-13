"use client";

import { useEffect, useState } from "react";
import { useWeather } from "@/modules/shared/hooks/useWeather";

function WeatherIcon({ code, size }: { code: number; size: number }) {
  const isSunny = code === 0;
  const isPartly = code === 1 || code === 2;
  const isCloudy = code === 3;
  const isFoggy = code === 45 || code === 48;
  const isRainy = [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code);
  const isSnowy = [71, 73, 75, 77].includes(code);
  const isStormy = [95, 96, 99].includes(code);
  const showSun = isSunny || isPartly || isStormy || isRainy;
  const showCloud =
    isPartly || isCloudy || isFoggy || isRainy || isSnowy || isStormy;
  const sunCx = showCloud ? 22 : 32;
  const sunCy = showCloud ? 20 : 32;
  const sunR = showCloud ? 9 : 14;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {showSun && (
        <circle cx={sunCx} cy={sunCy} r={sunR} fill="#f6c90e" opacity="0.9" />
      )}
      {isSunny && (
        <>
          <line
            x1="32"
            y1="10"
            x2="32"
            y2="4"
            stroke="#f6c90e"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="32"
            y1="54"
            x2="32"
            y2="60"
            stroke="#f6c90e"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="32"
            x2="4"
            y2="32"
            stroke="#f6c90e"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="54"
            y1="32"
            x2="60"
            y2="32"
            stroke="#f6c90e"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="16"
            y1="16"
            x2="12"
            y2="12"
            stroke="#f6c90e"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="48"
            y1="16"
            x2="52"
            y2="12"
            stroke="#f6c90e"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="16"
            y1="48"
            x2="12"
            y2="52"
            stroke="#f6c90e"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="48"
            y1="48"
            x2="52"
            y2="52"
            stroke="#f6c90e"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      {showCloud && (
        <>
          <ellipse
            cx="36"
            cy="34"
            rx="16"
            ry="10"
            fill="rgba(180,190,210,0.85)"
          />
          <ellipse
            cx="26"
            cy="36"
            rx="10"
            ry="8"
            fill="rgba(180,190,210,0.85)"
          />
          <ellipse
            cx="28"
            cy="30"
            rx="10"
            ry="9"
            fill="rgba(200,210,225,0.9)"
          />
        </>
      )}
      {isRainy && (
        <>
          <line
            x1="26"
            y1="46"
            x2="24"
            y2="52"
            stroke="#7fb3d3"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="34"
            y1="46"
            x2="32"
            y2="52"
            stroke="#7fb3d3"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="42"
            y1="46"
            x2="40"
            y2="52"
            stroke="#7fb3d3"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}
      {isSnowy && (
        <>
          <line
            x1="26"
            y1="46"
            x2="26"
            y2="52"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="34"
            y1="46"
            x2="34"
            y2="52"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="42"
            y1="46"
            x2="42"
            y2="52"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}
      {isStormy && (
        <polyline
          points="34,44 30,50 35,50 31,56"
          stroke="#f6c90e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {isFoggy && (
        <>
          <line
            x1="18"
            y1="46"
            x2="46"
            y2="46"
            stroke="rgba(200,210,225,0.6)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="22"
            y1="52"
            x2="42"
            y2="52"
            stroke="rgba(200,210,225,0.5)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export default function WeatherWidget({
  iconSize = 32,
}: {
  iconSize?: number;
}) {
  const { weather, loading } = useWeather();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  if (!mounted || loading) {
    return (
      <div
        className="flex items-center gap-2 px-1"
        style={{ minWidth: "80px", opacity: 0.4 }}
      >
        <div
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div
            style={{
              width: "36px",
              height: "11px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "4px",
            }}
          />
          <div
            style={{
              width: "28px",
              height: "9px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "4px",
            }}
          />
        </div>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="flex items-center gap-2 px-1">
      <WeatherIcon code={weather.code} size={iconSize} />
      <div className="flex flex-col leading-tight">
        <span
          style={{
            color: "white",
            fontSize: "16px",
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          {weather.temp !== null ? `${weather.temp}°C` : "--°C"}
        </span>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
          {weather.city !== "---" ? weather.city : (weather.condition ?? "")}
        </span>
      </div>
    </div>
  );
}
