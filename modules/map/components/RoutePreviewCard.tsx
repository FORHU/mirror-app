"use client";

import { useMapStore } from "../store/useMapStore";
import { Car, Bike, PersonStanding, X, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const TRANSPORT = [
  { profile: "car" as const, Icon: Car },
  { profile: "motorcycle" as const, Icon: Car },
  { profile: "bicycle" as const, Icon: Bike },
  { profile: "walking" as const, Icon: PersonStanding },
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
          key="nav-bar"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
          className="fixed bottom-0 left-0 right-0 z-40 pointer-events-auto"
          style={{
            background: "rgba(10,10,10,0.92)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Destination row */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Navigation className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-white truncate">
                {selectedDestination.name || selectedDestination.address}
              </p>
            </div>
            <button
              onClick={clearRoute}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center
                         rounded-full transition-colors active:scale-95"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <X className="w-3.5 h-3.5 text-white/50" />
            </button>
          </div>

          {/* Stats + transport row */}
          <div className="flex items-center justify-between px-5 pb-5">
            {isRouting ? (
              <p className="text-xs text-white/40 uppercase tracking-widest">
                Calculating…
              </p>
            ) : (
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-white/35 uppercase tracking-widest mb-0.5">
                    Distance
                  </p>
                  <p className="text-xl font-light text-blue-400">
                    {formatDistance(routeDistance)}
                  </p>
                </div>
                <div className="w-px h-7 bg-white/10" />
                <div>
                  <p className="text-[10px] text-white/35 uppercase tracking-widest mb-0.5">
                    ETA
                  </p>
                  <p className="text-xl font-light text-white/80">
                    {formatDuration(routeDuration)}
                  </p>
                </div>
              </div>
            )}

            {/* Transport mode */}
            <div className="flex gap-1.5">
              {TRANSPORT.map(({ profile, Icon }) => (
                <button
                  key={profile}
                  onClick={() => useMapStore.getState().setActiveProfile(profile)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl
                             transition-all active:scale-95"
                  style={activeProfile === profile ? BTN_ACTIVE : BTN_DIM}
                >
                  <Icon className="w-4 h-4 text-white/80" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
