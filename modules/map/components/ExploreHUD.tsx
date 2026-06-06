"use client";

import React, { useState } from "react";
import { useMapStore } from "../store/useMapStore";
import { INITIAL_VIEW_STATE } from "../constants/config";
import {
  Navigation,
  LocateFixed,
  X,
  Home,
  Check,
  MapPin,
  PersonStanding,
  Car,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
    selectedPOI,
    setSelectedPOI,
    setDestination,
    userLocation,
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
        (pos) =>
          setUserLocation({
            lng: pos.coords.longitude,
            lat: pos.coords.latitude,
          }),
        () => {},
      );
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {/* ── Bottom-right: icon cluster ── */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute bottom-28 right-6 flex flex-col gap-3 pointer-events-auto"
      >
        <IconButton
          onClick={handleRecenter}
          icon={<LocateFixed className="w-5 h-5 text-white/80" />}
        />
        <IconButton
          onClick={handleSetHomeHere}
          disabled={savingHome}
          icon={
            homeSaved ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <Home className="w-5 h-5 text-white/80" />
            )
          }
        />
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
                style={{
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
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
                  <div className="text-xl font-light text-white truncate">
                    {selectedPOI.name}
                  </div>
                </div>
              </div>

              {(selectedPOI.address || selectedPOI.distance != null) && (
                <div className="px-4 py-2 flex items-start gap-2 border-b border-white/8">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/40" />
                  <div className="flex flex-col gap-0.5">
                    {selectedPOI.address && (
                      <span className="text-xs text-white/60 leading-tight">
                        {selectedPOI.address}
                      </span>
                    )}
                    {selectedPOI.distance != null && (
                      <span className="text-xs text-white/40">
                        {selectedPOI.distance < 100
                          ? "Just ahead"
                          : selectedPOI.distance < 1000
                            ? `${Math.round(selectedPOI.distance / 10) * 10}m away`
                            : `${(selectedPOI.distance / 1000).toFixed(1)}km away`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {selectedPOI.travelFromStop && (
                <div className="px-4 py-2 flex items-center gap-4 border-b border-white/8">
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <PersonStanding className="w-3.5 h-3.5 text-white/40" />
                    {selectedPOI.travelFromStop.walkingMin} min
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <Car className="w-3.5 h-3.5 text-white/40" />
                    {selectedPOI.travelFromStop.carMin} min
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (selectedPOI.location) {
                    setDestination({
                      name: selectedPOI.name,
                      lng: selectedPOI.location.lng,
                      lat: selectedPOI.location.lat,
                    });
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
