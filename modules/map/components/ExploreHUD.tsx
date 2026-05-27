"use client";

import React, { useState } from "react";
import { useMapStore } from "../store/useMapStore";
import { INITIAL_VIEW_STATE } from "../constants/config";
import {
  Navigation,
  Car,
  Footprints,
  Bike,
  MoreHorizontal,
  Settings,
  LocateFixed,
  X,
  Bike as Motorcycle,
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
    startNavigation,
    activeRoute,
    fetchRoute,
    isRouting,
    selectedPOI,
    setSelectedPOI,
    setDestination,
    selectedDestination,
    userLocation,
    activeProfile,
    toggleTraffic,
    showTraffic,
    toggleTerrain,
    showTerrain,
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
        <IconButton onClick={toggleTerrain} active={showTerrain} icon={<MoreHorizontal className="w-5 h-5 text-white/80" />} />
      </motion.div>

      {/* ── Bottom-left: Transport selector + Route stats + Start ── */}
      <div className="absolute bottom-28 left-6 flex flex-col items-start gap-4 pointer-events-none">
        <AnimatePresence>
          {selectedDestination && (
            <motion.div
              key="go-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-start gap-4 pointer-events-auto"
            >
              {/* Transport mode selector */}
              <div className="flex items-center gap-2">
                <TransportButton active={activeProfile === "car"} onClick={() => useMapStore.getState().setActiveProfile("car")} icon={<Car className="w-5 h-5 text-white/80" />} />
                <TransportButton active={activeProfile === "motorcycle"} onClick={() => useMapStore.getState().setActiveProfile("motorcycle")} icon={<Motorcycle className="w-5 h-5 text-white/80" />} />
                <TransportButton active={activeProfile === "walking"} onClick={() => useMapStore.getState().setActiveProfile("walking")} icon={<Footprints className="w-5 h-5 text-white/80" />} />
                <TransportButton active={activeProfile === "bicycle"} onClick={() => useMapStore.getState().setActiveProfile("bicycle")} icon={<Bike className="w-5 h-5 text-white/80" />} />
              </div>

              {/* Route stats */}
              {activeRoute && (
                <div className="flex gap-8 px-6 py-4 rounded-2xl" style={PANEL}>
                  <div className="flex flex-col items-start">
                    <span className="text-4xl font-thin text-white leading-none">
                      {Math.ceil(activeRoute.duration / 60)}
                      <span className="text-lg ml-1 text-white/50">min</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-widest mt-1 text-white/40">Duration</span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-4xl font-thin text-white leading-none">
                      {(activeRoute.distance * 0.000621371).toFixed(1)}
                      <span className="text-lg ml-1 text-white/50">mi</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-widest mt-1 text-white/40">Distance</span>
                  </div>
                </div>
              )}

              {/* Start / Calculate button */}
              <button
                onClick={() => !activeRoute ? fetchRoute(true) : startNavigation()}
                className="text-white px-10 py-5 rounded-2xl text-2xl font-light flex items-center gap-3 transition-all active:scale-95"
                style={PANEL}
              >
                {isRouting ? "Calculating…" : !activeRoute ? "Calculate Route" : "Start Navigation"}
                <Navigation className="w-6 h-6 fill-white rotate-90" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

const TransportButton = ({
  active,
  icon,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="p-3 rounded-xl transition-all active:scale-95 flex items-center justify-center"
    style={active ? PANEL_ACTIVE : PANEL}
  >
    {icon}
  </button>
);
