"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, X } from "lucide-react";
import type { AmbientPOI } from "../hooks/useAmbientPOI";
import { useMapStore } from "../store/useMapStore";

interface Props {
  poi: AmbientPOI | null;
  onDismiss: () => void;
}

export default function AmbientPOICard({ poi, onDismiss }: Props) {
  const { setDestination, stopNavigation } = useMapStore();

  return (
    <AnimatePresence>
      {poi && (
        <motion.div
          key="ambient-poi"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="pointer-events-auto absolute left-0 bottom-36 w-64"
        >
          <div
            className="rounded-2xl px-4 py-3 flex flex-col gap-2"
            style={{
              background: "var(--ghost-bg)",
              border: "var(--ghost-panel-border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin
                  className="w-4 h-4 shrink-0"
                  style={{ color: "#4fc3f7" }}
                />
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "#4fc3f7" }}
                  >
                    {poi.category} nearby
                  </p>
                  <p
                    className="text-sm font-semibold leading-tight"
                    style={{ color: "var(--ghost-panel-text)" }}
                  >
                    {poi.name}
                  </p>
                </div>
              </div>
              <button
                onClick={onDismiss}
                className="shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white/50" />
              </button>
            </div>

            <p
              className="text-xs"
              style={{ color: "var(--ghost-panel-text)", opacity: 0.6 }}
            >
              {poi.distanceM < 100
                ? "Just ahead"
                : `~${Math.round(poi.distanceM / 10) * 10}m away`}
            </p>

            <button
              onClick={() => {
                stopNavigation();
                setDestination({ name: poi.name, lat: poi.lat, lng: poi.lng });
                onDismiss();
              }}
              className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
              style={{
                background: "rgba(79,195,247,0.15)",
                border: "1px solid rgba(79,195,247,0.4)",
              }}
            >
              <Navigation className="w-3.5 h-3.5" />
              Navigate There
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
