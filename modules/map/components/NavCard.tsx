"use client";

import { useMemo } from "react";
import { useMapStore } from "../store/useMapStore";
import { AnimatePresence, motion } from "framer-motion";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import {
  Navigation,
  Car,
  Footprints,
  Bike,
  Bike as Motorcycle,
  X,
  Map,
  Compass,
} from "lucide-react";

const DIVIDER = { borderColor: "rgba(255,255,255,0.08)" } as const;

const PANEL = {
  background: "rgba(0,0,0,0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.12)",
} as const;

const BTN_DIM = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
} as const;

const BTN_ACTIVE = {
  background: "rgba(0,0,0,0.95)",
  border: "1.5px solid rgba(255,255,255,0.8)",
} as const;

const TRANSPORT = [
  { profile: "car" as const, Icon: Car },
  { profile: "motorcycle" as const, Icon: Motorcycle },
  { profile: "walking" as const, Icon: Footprints },
  { profile: "bicycle" as const, Icon: Bike },
];

export default function NavCard() {
  const {
    isNavigating,
    selectedDestination,
    activeRoute,
    fetchRoute,
    isRouting,
    startNavigation,
    stopNavigation,
    activeProfile,
    cameraMode,
    setCameraMode,
  } = useMapStore();

  const distance = activeRoute?.distance ?? 0;
  const duration = activeRoute?.duration ?? 0;

  const eta = useMemo(() => {
    if (duration <= 0) return "--";
    const h = Math.floor(duration / 3600);
    const m = Math.ceil((duration % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  }, [duration]);

  const distanceFormatted = useMemo(() => {
    if (distance <= 0) return "0 m";
    if (distance < 1000) return `${Math.round(distance)} m`;
    return `${(distance / 1000).toFixed(1)} km`;
  }, [distance]);

  const { transcriptOpen } = useVoiceContext();
  const visible = !!selectedDestination || isNavigating;

  return (
    <div className="fixed bottom-28 left-6 z-40 pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            key="nav-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: transcriptOpen ? -88 : 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-72 rounded-2xl overflow-hidden pointer-events-auto"
            style={PANEL}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isNavigating ? (
                /* ── Navigation state ── */
                <motion.div
                  key="nav"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Distance + ETA */}
                  <div
                    className="flex gap-6 px-5 py-4 border-b"
                    style={DIVIDER}
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                        Distance
                      </span>
                      <span className="text-3xl font-thin text-white/90">
                        {distanceFormatted}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                        Duration
                      </span>
                      <span className="text-3xl font-thin text-white/90">
                        {eta}
                      </span>
                    </div>
                  </div>

                  {/* Camera toggle + Stop */}
                  <div className="flex gap-2 p-3">
                    <button
                      onClick={() =>
                        setCameraMode(
                          cameraMode === "follow" ? "overview" : "follow",
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                      style={cameraMode === "overview" ? BTN_ACTIVE : BTN_DIM}
                    >
                      {cameraMode === "follow" ? (
                        <Map className="w-4 h-4 text-white/60" />
                      ) : (
                        <Compass
                          className="w-4 h-4"
                          style={{ color: "#4fc3f7" }}
                        />
                      )}
                      <span className="text-[10px] uppercase tracking-widest text-white/50">
                        {cameraMode === "follow" ? "Overview" : "Follow"}
                      </span>
                    </button>

                    <button
                      onClick={stopNavigation}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                      style={{
                        background: "rgba(239,68,68,0.2)",
                        border: "1px solid rgba(239,68,68,0.4)",
                      }}
                    >
                      <X className="w-4 h-4 text-red-400" />
                      <span className="text-[10px] uppercase tracking-widest text-red-400">
                        Stop
                      </span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* ── Explore / route preview state ── */
                <motion.div
                  key="explore"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Transport selector */}
                  <div className="flex gap-2 p-3 border-b" style={DIVIDER}>
                    {TRANSPORT.map(({ profile, Icon }) => (
                      <button
                        key={profile}
                        onClick={() =>
                          useMapStore.getState().setActiveProfile(profile)
                        }
                        className="flex-1 flex items-center justify-center py-2.5 rounded-xl transition-all active:scale-95"
                        style={activeProfile === profile ? BTN_ACTIVE : BTN_DIM}
                      >
                        <Icon className="w-5 h-5 text-white/80" />
                      </button>
                    ))}
                  </div>

                  {/* Route stats — only when route is calculated */}
                  {activeRoute && (
                    <div
                      className="flex gap-6 px-5 py-4 border-b"
                      style={DIVIDER}
                    >
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                          Duration
                        </span>
                        <span className="text-3xl font-thin text-white leading-none">
                          {Math.ceil(activeRoute.duration / 60)}
                          <span className="text-base ml-1 text-white/50">
                            min
                          </span>
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                          Distance
                        </span>
                        <span className="text-3xl font-thin text-white leading-none">
                          {(activeRoute.distance * 0.000621371).toFixed(1)}
                          <span className="text-base ml-1 text-white/50">
                            mi
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Start / Calculate button */}
                  <button
                    onClick={() =>
                      !activeRoute ? fetchRoute(true) : startNavigation()
                    }
                    className="w-full flex items-center justify-between px-5 py-4 text-white text-lg font-light transition-all active:scale-95"
                  >
                    <span>
                      {isRouting
                        ? "Calculating…"
                        : !activeRoute
                          ? "Calculate Route"
                          : "Start Navigation"}
                    </span>
                    <Navigation className="w-5 h-5 fill-white rotate-90 shrink-0" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
