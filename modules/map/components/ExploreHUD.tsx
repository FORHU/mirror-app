"use client";

import React, { useEffect, useState } from "react";
import { useMapStore } from "../store/useMapStore";
import { INITIAL_VIEW_STATE } from "../constants/config";
import {
  Navigation,
  Car, Footprints, Bike, MoreHorizontal, Mic, MicOff, Loader2, Volume2,
  Settings, LocateFixed, X, Bike as Motorcycle,
  Sun, Cloud, CloudSun, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";

const WEATHER_ICONS: Record<number, { icon: React.ReactNode; color: string }> = {
  0:  { icon: <Sun           className="w-5 h-5" />, color: "#fbbf24" },
  1:  { icon: <CloudSun      className="w-5 h-5" />, color: "#fbbf24" },
  2:  { icon: <CloudSun      className="w-5 h-5" />, color: "#94a3b8" },
  3:  { icon: <Cloud         className="w-5 h-5" />, color: "#94a3b8" },
  45: { icon: <CloudFog      className="w-5 h-5" />, color: "#94a3b8" },
  48: { icon: <CloudFog      className="w-5 h-5" />, color: "#94a3b8" },
  51: { icon: <CloudDrizzle  className="w-5 h-5" />, color: "#7dd3fc" },
  53: { icon: <CloudDrizzle  className="w-5 h-5" />, color: "#7dd3fc" },
  55: { icon: <CloudDrizzle  className="w-5 h-5" />, color: "#7dd3fc" },
  61: { icon: <CloudRain     className="w-5 h-5" />, color: "#60a5fa" },
  63: { icon: <CloudRain     className="w-5 h-5" />, color: "#60a5fa" },
  65: { icon: <CloudRain     className="w-5 h-5" />, color: "#60a5fa" },
  71: { icon: <CloudSnow     className="w-5 h-5" />, color: "#e2e8f0" },
  73: { icon: <CloudSnow     className="w-5 h-5" />, color: "#e2e8f0" },
  75: { icon: <CloudSnow     className="w-5 h-5" />, color: "#e2e8f0" },
  95: { icon: <CloudLightning className="w-5 h-5" />, color: "#a78bfa" },
};

function getWeatherIcon(code: number) {
  return WEATHER_ICONS[code] ?? { icon: <Cloud className="w-5 h-5" />, color: "#94a3b8" };
}

interface DayWeather { high: number; low: number; code: number }

function useDayWeather(lat?: number, lng?: number): DayWeather | null {
  const [data, setData] = useState<DayWeather | null>(null);

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const params = new URLSearchParams({
      latitude:  String(lat),
      longitude: String(lng),
      daily:     "temperature_2m_max,temperature_2m_min,weathercode",
      timezone:  "auto",
      forecast_days: "1",
    });
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
      .then((r) => r.json())
      .then((json) => {
        const d = json.daily;
        if (!d) return;
        setData({
          high: Math.round(d.temperature_2m_max[0]),
          low:  Math.round(d.temperature_2m_min[0]),
          code: d.weathercode[0],
        });
      })
      .catch(() => {});
  }, [lat, lng]);

  return data;
}

export const ExploreHUD = () => {
  const {
    isNavigating, startNavigation, activeRoute, fetchRoute, isRouting,
    selectedPOI, setSelectedPOI, setDestination, selectedDestination, userLocation,
    activeProfile,
    toggleTraffic, showTraffic, toggleTerrain, showTerrain,
    map, origin, setUserLocation, homeLocation,
  } = useMapStore();

  const loc = userLocation ?? homeLocation;
  const dayWeather = useDayWeather(loc?.lat, loc?.lng);

  const { voiceState, isListening, isProcessing, isSpeaking, transcript, reply, error, toggle } = useVoiceAssistant();

  const micIcon = isListening
    ? <MicOff className="w-5 h-5" style={{ color: "#ef4444" }} />
    : isProcessing
      ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#4fc3f7" }} />
      : isSpeaking
        ? <Volume2 className="w-5 h-5" style={{ color: "#4fc3f7" }} />
        : <Mic className="w-5 h-5" style={{ color: "var(--ghost-btn-icon)" }} />;

  const handleRecenter = () => {
    const target = userLocation || origin;
    if (map && target) {
      map.easeTo({
        center: [target.lng, target.lat],
        zoom: INITIAL_VIEW_STATE.zoom,
        pitch: INITIAL_VIEW_STATE.pitch,
        bearing: INITIAL_VIEW_STATE.bearing,
        duration: 1000
      });
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
        () => {}
      );
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 p-6 font-sans">

      {/* ── Top-left: Weather ───────────────────────────────────────── */}
      {!isNavigating && dayWeather && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute top-0 left-0 pointer-events-auto"
        >
          <div
            className="flex items-center gap-3 rounded-2xl px-5 py-3"
            style={{ background: "var(--ghost-bg)", border: "var(--ghost-panel-border)" }}
          >
            <span style={{ color: getWeatherIcon(dayWeather.code).color }}>
              {getWeatherIcon(dayWeather.code).icon}
            </span>
            <span className="text-base font-bold" style={{ color: "var(--ghost-weather-text)" }}>
              H: {dayWeather.high}° L: {dayWeather.low}°
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Top-right: Action buttons ───────────────────────────────── */}
      {!isNavigating && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute top-0 right-0 flex flex-col gap-3 pointer-events-auto"
        >
          <IconButton onClick={handleRecenter} icon={<LocateFixed className="w-5 h-5" style={{ color: "var(--ghost-btn-icon)" }} />} />
          <IconButton onClick={toggle} active={isListening || isProcessing || isSpeaking} icon={micIcon} />
          <IconButton onClick={toggleTraffic} active={showTraffic} icon={<Settings className="w-5 h-5" style={{ color: "var(--ghost-btn-icon)" }} />} />
        </motion.div>
      )}

      {/* ── Voice transcript bubble ─────────────────────────────────── */}
      <AnimatePresence>
        {!isNavigating && (transcript || reply || error) && (
          <motion.div
            key="voice-bubble"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 w-[340px] pointer-events-none"
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

      {/* ── Bottom-right: Route stats + Start Navigation ────────────── */}
      {!isNavigating && (
        <div className="absolute bottom-0 right-0 flex flex-col items-end gap-4 pointer-events-none">
          <AnimatePresence>
            {selectedDestination && (
              <motion.div
                key="go-panel"
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                className="flex flex-col items-end gap-4 pointer-events-auto"
              >
                {activeRoute && (
                  <div
                    className="flex gap-8 px-6 py-4 rounded-2xl"
                    style={{ background: "var(--ghost-bg)", border: "var(--ghost-panel-border)" }}
                  >
                    <div className="flex flex-col items-end">
                      <span className="text-4xl font-bold leading-none" style={{ color: "var(--ghost-panel-text)" }}>
                        {Math.ceil(activeRoute.duration / 60)}<span className="text-lg ml-1">min</span>
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60" style={{ color: "var(--ghost-panel-text)" }}>
                        Duration
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-4xl font-bold leading-none" style={{ color: "var(--ghost-panel-text)" }}>
                        {(activeRoute.distance * 0.000621371).toFixed(1)}<span className="text-lg ml-1">mi</span>
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60" style={{ color: "var(--ghost-panel-text)" }}>
                        Distance
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => (!activeRoute ? fetchRoute(true) : startNavigation())}
                  className="text-white px-10 py-5 rounded-2xl text-2xl font-bold flex items-center gap-3 transition-all active:scale-95"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "2px solid rgba(255,255,255,0.9)",
                    boxShadow: "0 0 30px rgba(255,255,255,0.15)"
                  }}
                >
                  {isRouting ? "Calculating…" : (!activeRoute ? "Calculate Route" : "Start Navigation")}
                  <Navigation className="w-6 h-6 fill-white rotate-90" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transport mode selector */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <TransportButton active={activeProfile === "car"}        onClick={() => useMapStore.getState().setActiveProfile("car")}        icon={<Car        className="w-5 h-5" style={{ color: "var(--ghost-btn-icon)" }} />} />
            <TransportButton active={activeProfile === "motorcycle"} onClick={() => useMapStore.getState().setActiveProfile("motorcycle")} icon={<Motorcycle className="w-5 h-5" style={{ color: "var(--ghost-btn-icon)" }} />} />
            <TransportButton active={activeProfile === "walking"}    onClick={() => useMapStore.getState().setActiveProfile("walking")}    icon={<Footprints className="w-5 h-5" style={{ color: "var(--ghost-btn-icon)" }} />} />
            <TransportButton active={activeProfile === "bicycle"}    onClick={() => useMapStore.getState().setActiveProfile("bicycle")}    icon={<Bike       className="w-5 h-5" style={{ color: "var(--ghost-btn-icon)" }} />} />
            <IconButton onClick={toggleTerrain} active={showTerrain} icon={<MoreHorizontal className="w-5 h-5" style={{ color: "var(--ghost-btn-icon)" }} />} />
          </div>
        </div>
      )}

      {/* ── POI details card ────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedPOI && !isNavigating && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute left-0 bottom-0 w-[380px] pointer-events-auto"
          >
            <div className="relative">
              <button
                onClick={() => setSelectedPOI(null)}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 p-2 rounded-full text-white z-10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Image with text overlaid — no panel background */}
              <div className="w-full h-44 rounded-2xl overflow-hidden relative mb-3">
                <img
                  src={`https://loremflickr.com/800/600/${encodeURIComponent(selectedPOI.category || 'place')}`}
                  alt={selectedPOI.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
                    {(selectedPOI.category || 'Location').replace(/_/g, ' ')}
                  </div>
                  <div className="text-xl font-bold text-white truncate">
                    {selectedPOI.name}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (selectedPOI.location) {
                    setDestination({ name: selectedPOI.name, lng: selectedPOI.location.lng, lat: selectedPOI.location.lat });
                    setSelectedPOI(null);
                  }
                }}
                className="w-full py-4 text-base font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-white"
                style={{ background: "none" }}
              >
                <Navigation className="w-4 h-4 fill-current" />
                GO TO THIS PLACE
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

const IconButton = ({ icon, onClick, active = false, className = "" }: {
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={`p-3 rounded-xl transition-all flex items-center justify-center ${className}`}
    style={{
      background: active ? "rgba(255,255,255,0.2)" : "var(--ghost-bg)",
      border: active ? "1px solid rgba(255,255,255,0.5)" : "var(--ghost-btn-border)",
      boxShadow: active ? "0 0 12px rgba(255,255,255,0.1)" : "none"
    }}
  >
    {icon}
  </button>
);

const TransportButton = ({ active, icon, onClick }: { active: boolean; icon: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="p-3 rounded-xl transition-all flex items-center justify-center"
    style={{
      background: active ? "rgba(255,255,255,0.2)" : "var(--ghost-bg)",
      border: active ? "1px solid rgba(255,255,255,0.5)" : "var(--ghost-btn-border)",
      boxShadow: active ? "0 0 12px rgba(255,255,255,0.1)" : "none"
    }}
  >
    {icon}
  </button>
);
