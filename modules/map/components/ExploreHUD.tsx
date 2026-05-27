"use client";

import React, { useState } from "react";
import { useMapStore } from "../store/useMapStore";
import { INITIAL_VIEW_STATE } from "../constants/config";
import {
  Navigation,
  Settings,
  LocateFixed,
  X,
  Home,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PANEL = {
  background: "rgba(0,0,0,0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.12)",
} as const;

const PANEL_ACTIVE = {
  background: "rgba(0,0,0,0.95)",
  backdropFilter: "blur(12px)",
  border: "1.5px solid rgba(255,255,255,0.8)",
} as const;

export const ExploreHUD = () => {
  const {
    isNavigating,
    selectedPOI,
    setSelectedPOI,
    setDestination,
    userLocation,
    toggleTraffic,
    showTraffic,
    map,
    origin,
    setUserLocation,
    patchHomeLocation,
  } = useMapStore();

  const [savingHome, setSavingHome] = useState(false);
  const [homeSaved, setHomeSaved] = useState(false);

  const handleSetHomeHere = async () => {
    const target = userLocation || origin;
    if (!target || savingHome) return;
    setSavingHome(true);
    try {
      await patchHomeLocation(target);
      setHomeSaved(true);
      setTimeout(() => setHomeSaved(false), 2000);
    } finally {
      setSavingHome(false);
    }
  };

  const handleRecenter = () => {
    const target = userLocation || origin;
    if (map && target) {
      map.easeTo({
        center: [target.lng, target.lat],
        zoom: INITIAL_VIEW_STATE.zoom,
        pitch: INITIAL_VIEW_STATE.pitch,
        bearing: INITIAL_VIEW_STATE.bearing,
        duration: 1000,
      });
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
        () => {},
      );
    }
  };

  if (isNavigating) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {/* ── Bottom-right: icon cluster ── */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute bottom-28 right-6 flex flex-col gap-3 pointer-events-auto"
      >
        <IconButton onClick={handleRecenter} icon={<LocateFixed className="w-5 h-5 text-white/80" />} />
        <IconButton
          onClick={handleSetHomeHere}
          disabled={savingHome}
          icon={
            homeSaved
              ? <Check className="w-5 h-5 text-green-400" />
              : <Home className="w-5 h-5 text-white/80" />
          }
        />
        <IconButton onClick={toggleTraffic} active={showTraffic} icon={<Settings className="w-5 h-5 text-white/80" />} />
      </motion.div>

      {/* ── Bottom-left: POI details card ── */}
      <AnimatePresence>
        {selectedPOI && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="absolute left-6 bottom-28 w-[340px] pointer-events-auto"
          >
            <div className="relative rounded-2xl overflow-hidden" style={PANEL}>
              <button
                onClick={() => setSelectedPOI(null)}
                className="absolute top-3 right-3 p-2 rounded-full z-10 transition-all active:scale-95"
                style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <X className="w-4 h-4 text-white" />
              </button>

              <div className="w-full h-40 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    selectedPOI.photo ||
                    `https://loremflickr.com/800/600/${encodeURIComponent(selectedPOI.category || "place")}`
                  }
                  alt={selectedPOI.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="text-xs uppercase tracking-widest text-white/50 mb-1">
                    {(selectedPOI.category || "Location").replace(/_/g, " ")}
                  </div>
                  <div className="text-xl font-light text-white truncate">{selectedPOI.name}</div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (selectedPOI.location) {
                    setDestination({ name: selectedPOI.name, lng: selectedPOI.location.lng, lat: selectedPOI.location.lat });
                    setSelectedPOI(null);
                  }
                }}
                className="w-full py-4 text-sm font-light uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 text-white/70 hover:text-white"
              >
                <Navigation className="w-4 h-4 fill-current" />
                Go to this place
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const IconButton = ({
  icon,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="p-3 rounded-xl transition-all active:scale-95 flex items-center justify-center disabled:opacity-40"
    style={active ? PANEL_ACTIVE : PANEL}
  >
    {icon}
  </button>
);

