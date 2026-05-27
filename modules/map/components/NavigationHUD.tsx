"use client";

import { useMemo } from "react";
import { useMapStore } from "../store/useMapStore";
import { X, Map, Compass } from "lucide-react";
import { useAmbientPOI } from "../hooks/useAmbientPOI";
import AmbientPOICard from "./AmbientPOICard";

const PANEL = {
  background: "rgba(0,0,0,0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.12)",
} as const;

const TOP_OFFSET = "top-24";

const NavigationHUD = () => {
  const { activeRoute, stopNavigation, cameraMode, setCameraMode } = useMapStore();
  const { ambientPOI, dismissAmbientPOI } = useAmbientPOI();

  const distance = activeRoute?.distance ?? 0;
  const duration = activeRoute?.duration ?? 0;

  const eta = useMemo(() => {
    const arrival = new Date(Date.now() + duration * 1000);
    return arrival.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [duration]);

  const distanceFormatted = useMemo(() => {
    if (distance <= 0) return "0 m";
    if (distance < 1000) return `${Math.round(distance)} m`;
    return `${(distance / 1000).toFixed(1)} km`;
  }, [distance]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {/* ── Top-left: Distance + ETA stacked, below header ── */}
      <div className={`absolute left-6 ${TOP_OFFSET} flex flex-col gap-3`}>
        <div className="flex flex-col gap-1 px-5 py-3 rounded-2xl" style={PANEL}>
          <span className="text-xs uppercase tracking-widest text-white/50">Distance</span>
          <span className="text-4xl font-thin text-white/90">{distanceFormatted}</span>
        </div>

        <div className="flex flex-col gap-1 px-5 py-3 rounded-2xl" style={PANEL}>
          <span className="text-xs uppercase tracking-widest text-white/50">ETA</span>
          <span className="text-4xl font-thin text-white/90">{eta}</span>
        </div>
      </div>

      {/* ── Bottom-left: Ambient POI ── */}
      <div className="absolute left-6 bottom-28">
        <AmbientPOICard poi={ambientPOI} onDismiss={dismissAmbientPOI} />
      </div>

      {/* ── Bottom-right: Camera + Stop controls ── */}
      <div className="absolute bottom-28 right-6 flex flex-col gap-3 pointer-events-auto">
        <button
          onClick={() => setCameraMode(cameraMode === "follow" ? "overview" : "follow")}
          className="flex flex-col items-center justify-center w-14 h-14 rounded-full gap-1 transition-all active:scale-95"
          style={PANEL}
        >
          {cameraMode === "follow" ? (
            <Map className="w-5 h-5 text-white/60" />
          ) : (
            <Compass className="w-5 h-5" style={{ color: "#4fc3f7" }} />
          )}
          <span className="text-[8px] text-white/40 uppercase tracking-widest">
            {cameraMode === "follow" ? "Overview" : "Follow"}
          </span>
        </button>

        <button
          onClick={stopNavigation}
          className="flex items-center justify-center w-14 h-14 rounded-full transition-all active:scale-95"
          style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.5)", backdropFilter: "blur(12px)" }}
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
};

export default NavigationHUD;
