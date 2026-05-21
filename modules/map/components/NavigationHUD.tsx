"use client";

import React, { useMemo } from "react";
import { useMapStore } from "../store/useMapStore";
import { X, Map, Compass, MapPin, Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { useNavigationAnnouncements } from "../hooks/useNavigationAnnouncements";
import { useAmbientPOI } from "../hooks/useAmbientPOI";
import AmbientPOICard from "./AmbientPOICard";

// Returns color + label based on how close the user is
function getProximity(distanceM: number) {
  if (distanceM <= 100) return { color: "#ef4444", label: "Arriving Now",  pulse: true  };
  if (distanceM <= 300) return { color: "#f97316", label: "Almost There",  pulse: false };
  if (distanceM <= 800) return { color: "#facc15", label: "Getting Close", pulse: false };
  return                       { color: "#4fc3f7", label: "En Route",      pulse: false };
}

const NavigationHUD = () => {
  const {
    remainingDistance,
    remainingDuration,
    stopNavigation,
    cameraMode,
    setCameraMode,
    activeRoute,
  } = useMapStore();

  const { isListening, isProcessing, isSpeaking, transcript, reply, error, toggle } = useVoiceContext();
  useNavigationAnnouncements();
  const { ambientPOI, dismissAmbientPOI } = useAmbientPOI();

  const micIcon = isListening
    ? <MicOff className="w-5 h-5" style={{ color: "#ef4444" }} />
    : isProcessing
      ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#4fc3f7" }} />
      : isSpeaking
        ? <Volume2 className="w-5 h-5" style={{ color: "#4fc3f7" }} />
        : <Mic className="w-5 h-5 text-white/70" />;

  const eta = useMemo(
    // eslint-disable-next-line react-hooks/purity
    () => new Date(Date.now() + remainingDuration * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    [remainingDuration],
  );

  // Smart distance formatting
  const distanceFormatted = useMemo(() => {
    if (remainingDistance <= 0) return "0 m";
    if (remainingDistance < 1000) return `${Math.round(remainingDistance)} m`;
    return `${(remainingDistance / 1000).toFixed(1)} km`;
  }, [remainingDistance]);

  // Progress 0→1 from total route distance
  const totalDistance = activeRoute?.distance || activeRoute?.routes?.[0]?.distance || 0;
  const progress = totalDistance > 0
    ? Math.max(0, Math.min(1, 1 - remainingDistance / totalDistance))
    : 0;

  const proximity = getProximity(remainingDistance);

  return (
    <div className="hud-container pointer-events-none fixed inset-0 flex flex-col justify-between" style={{ padding: "2.5rem" }}>

      {/* ── Top HUD ── */}
      <div className="flex justify-between items-start">
        {/* Distance remaining */}
        <div className="flex flex-col gap-1">
          <span className="text-(--hud-text-label) text-xs uppercase tracking-widest" style={{ textShadow: 'var(--hud-text-shadow)' }}>
            Distance
          </span>
          <motion.span
            key={distanceFormatted}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-light"
            style={{ color: proximity.color, textShadow: 'var(--hud-text-shadow)' }}
          >
            {distanceFormatted}
          </motion.span>
        </div>

        {/* ETA */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-(--hud-text-label) text-xs uppercase tracking-widest" style={{ textShadow: 'var(--hud-text-shadow)' }}>
            ETA
          </span>
          <span className="text-(--hud-text-secondary) text-3xl font-light" style={{ textShadow: 'var(--hud-text-shadow)' }}>
            {eta}
          </span>
        </div>
      </div>

      {/* ── Bottom HUD ── */}
      <div className="flex flex-col gap-3">

        {/* Ambient POI card — proactive nearby place announcements */}
        <AmbientPOICard poi={ambientPOI} onDismiss={dismissAmbientPOI} />

        {/* Proximity Banner — only when we have real distance data AND close enough */}
        <AnimatePresence>
          {totalDistance > 0 && remainingDistance > 0 && remainingDistance <= 800 && (
            <motion.div
              key="proximity-banner"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="flex items-center justify-center gap-3"
            >
              {/* Pulsing destination pin */}
              <motion.div
                animate={proximity.pulse ? { scale: [1, 1.18, 1] } : {}}
                transition={{ repeat: Infinity, duration: 0.7 }}
                className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
                style={{
                  background: `${proximity.color}22`,
                  border: `2px solid ${proximity.color}`,
                }}
              >
                <MapPin className="w-5 h-5" style={{ color: proximity.color }} />
              </motion.div>

              {/* Status label */}
              <span
                className="text-sm font-bold uppercase tracking-widest px-5 py-2 rounded-full"
                style={{
                  color: proximity.color,
                  background: `${proximity.color}18`,
                  border: `1px solid ${proximity.color}44`,
                  textShadow: '0 0 12px currentColor',
                }}
              >
                {proximity.label}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/30 uppercase tracking-widest w-8 text-right">
            {Math.round(progress * 100)}%
          </span>
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: proximity.color }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <MapPin className="w-3.5 h-3.5" style={{ color: proximity.color }} />
        </div>

        {/* Voice bubble */}
        <AnimatePresence>
          {(transcript || reply || error) && (
            <motion.div
              key="nav-voice-bubble"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="pointer-events-none"
            >
              <div
                className="rounded-2xl px-4 py-3"
                style={{ background: "var(--ghost-bg)", border: "var(--ghost-panel-border)" }}
              >
                {error ? (
                  <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
                ) : (
                  <>
                    {transcript && (
                      <p className="text-xs opacity-60 leading-tight mb-1" style={{ color: "var(--ghost-panel-text)" }}>
                        <span className="font-semibold opacity-80">You:</span> {transcript}
                      </p>
                    )}
                    {reply && (
                      <p className="text-sm leading-snug" style={{ color: "var(--ghost-panel-text)" }}>
                        <span className="font-semibold" style={{ color: "#4fc3f7" }}>AI:</span> {reply}
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Control buttons */}
        <div className="flex justify-center items-center gap-4">
          {/* Camera Mode Toggle */}
          <button
            onClick={() => setCameraMode(cameraMode === 'follow' ? 'overview' : 'follow')}
            className="pointer-events-auto flex flex-col items-center justify-center w-16 h-16 rounded-full border border-white/20 hover:bg-white/10 transition-colors gap-1"
          >
            {cameraMode === 'follow'
              ? <Map className="w-6 h-6 text-white/60" />
              : <Compass className="w-6 h-6 text-[#4fc3f7]" />
            }
            <span className="text-[9px] text-white/40 uppercase tracking-widest">
              {cameraMode === 'follow' ? 'Overview' : 'Follow'}
            </span>
          </button>

          {/* Mic button */}
          <button
            onClick={toggle}
            className="pointer-events-auto flex flex-col items-center justify-center w-16 h-16 rounded-full transition-colors gap-1"
            style={{
              background: (isListening || isProcessing || isSpeaking) ? "rgba(79,195,247,0.15)" : "rgba(255,255,255,0.08)",
              border: (isListening || isProcessing || isSpeaking) ? "1px solid rgba(79,195,247,0.5)" : "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {micIcon}
            <span className="text-[9px] text-white/40 uppercase tracking-widest">Ask AI</span>
          </button>

          {/* Stop Navigation */}
          <button
            onClick={stopNavigation}
            className="pointer-events-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-600/40 border border-red-500/40 hover:bg-red-500/60 transition-colors"
          >
            <X className="w-7 h-7 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationHUD;
