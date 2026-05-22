"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Home, Loader2, MapPin } from "lucide-react";
import { useMapStore } from "../store/useMapStore";

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}

function formatMinutes(seconds: number) {
  return Math.ceil(seconds / 60);
}

function formatTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommuteWidget() {
  const {
    isNavigating,
    commuteEta,
    commuteEtaLoading,
    workLocation,
    fetchCommuteEta,
    setWorkLocation,
    selectedDestination,
  } = useMapStore();

  const [clock, setClock] = useState(formatTime());
  const [settingWork, setSettingWork] = useState(false);

  // Update clock every minute
  useEffect(() => {
    const id = setInterval(() => setClock(formatTime()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fetch commute ETA on mount + every 5 min
  useEffect(() => {
    fetchCommuteEta();
    const id = setInterval(fetchCommuteEta, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchCommuteEta]);

  // If user selects a destination while in "set work" mode, save it as work
  useEffect(() => {
    if (settingWork && selectedDestination) {
      setWorkLocation({
        lat: selectedDestination.lat,
        lng: selectedDestination.lng,
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettingWork(false);
    }
  }, [selectedDestination, settingWork, setWorkLocation]);

  if (isNavigating) return null;

  const hour = new Date().getHours();
  const showCommute = (hour >= 6 && hour < 11) || (hour >= 17 && hour < 22);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-1"
    >
      {/* Clock + greeting */}
      <div className="flex items-baseline gap-3">
        <span
          className="text-4xl font-light text-white"
          style={{ textShadow: "0 0 20px rgba(0,0,0,0.8)" }}
        >
          {clock}
        </span>
        <span
          className="text-sm text-white/60"
          style={{ textShadow: "0 0 12px rgba(0,0,0,0.8)" }}
        >
          {greeting()}
        </span>
      </div>

      {/* Commute ETA */}
      <AnimatePresence>
        {showCommute && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {commuteEtaLoading ? (
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Checking commute…</span>
              </div>
            ) : commuteEta ? (
              <div className="flex items-center gap-2">
                {commuteEta.to === "work" ? (
                  <Briefcase className="w-3.5 h-3.5 text-white/60" />
                ) : (
                  <Home className="w-3.5 h-3.5 text-white/60" />
                )}
                <span
                  className="text-white font-semibold text-sm"
                  style={{ textShadow: "0 0 12px rgba(0,0,0,0.8)" }}
                >
                  {formatMinutes(commuteEta.duration)} min
                </span>
                <span className="text-white/50 text-xs">
                  to {commuteEta.to === "work" ? "work" : "home"}
                </span>
              </div>
            ) : !workLocation && hour >= 6 && hour < 11 ? (
              <button
                onClick={() => setSettingWork(true)}
                className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition-colors"
              >
                <MapPin className="w-3 h-3" />
                {settingWork
                  ? "Search for your workplace…"
                  : "Set work location"}
              </button>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
