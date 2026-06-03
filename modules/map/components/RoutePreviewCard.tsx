"use client";

import { useMapStore } from "../store/useMapStore";
import { Car, Bike, PersonStanding, X, Bike as MotoIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const TRANSPORT = [
  { profile: "car" as const, Icon: Car, label: "Car" },
  { profile: "motorcycle" as const, Icon: MotoIcon, label: "Moto" },
  { profile: "bicycle" as const, Icon: Bike, label: "Bike" },
  { profile: "walking" as const, Icon: PersonStanding, label: "Walk" },
];

const BTN_DIM = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
} as const;

const BTN_ACTIVE = {
  background: "#2144c0",
  border: "1.5px solid rgba(255,255,255,0.3)",
} as const;

function formatDistance(metres: number): string {
  if (metres <= 0) return "—";
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

export default function RoutePreviewCard() {
  const {
    selectedDestination,
    routeDistance,
    routeDuration,
    activeProfile,
    isRouting,
    clearRoute,
  } = useMapStore();

  return (
    <AnimatePresence>
      {selectedDestination && (
        <motion.div
          key="route-preview-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="pointer-events-auto"
          style={{
            background: "var(--ghost-bg)",
            border: "var(--ghost-panel-border)",
            borderRadius: "1.25rem",
            padding: "1.25rem 1.5rem",
            minWidth: "280px",
          }}
        >
          {/* Destination name + close */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <p
              className="text-sm font-semibold leading-tight"
              style={{ color: "var(--ghost-panel-text)" }}
            >
              {selectedDestination.name || selectedDestination.address}
            </p>
            <button
              onClick={clearRoute}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white/50" />
            </button>
          </div>

          {/* Transport mode selector */}
          <div className="flex gap-2 mb-4">
            {TRANSPORT.map(({ profile, Icon, label }) => (
              <button
                key={profile}
                onClick={() => useMapStore.getState().setActiveProfile(profile)}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all active:scale-95"
                style={activeProfile === profile ? BTN_ACTIVE : BTN_DIM}
              >
                <Icon className="w-4 h-4 text-white/80" />
                <span className="text-[10px] text-white/60 leading-none">
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10 mb-3" />

          {/* Distance + ETA */}
          {isRouting ? (
            <p className="text-xs text-white/40 uppercase tracking-widest">
              Calculating…
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-xs text-white/40 uppercase tracking-widest mb-0.5">
                  Distance
                </span>
                <span
                  className="text-2xl font-light"
                  style={{
                    color: "#4fc3f7",
                    textShadow: "var(--hud-text-shadow)",
                  }}
                >
                  {formatDistance(routeDistance)}
                </span>
              </div>

              <div className="w-px h-8 bg-white/10" />

              <div className="flex flex-col">
                <span className="text-xs text-white/40 uppercase tracking-widest mb-0.5">
                  ETA
                </span>
                <span
                  className="text-2xl font-light"
                  style={{
                    color: "var(--ghost-panel-text)",
                    textShadow: "var(--hud-text-shadow)",
                  }}
                >
                  {formatDuration(routeDuration)}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
