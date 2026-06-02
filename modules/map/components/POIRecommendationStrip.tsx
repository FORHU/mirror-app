"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin } from "lucide-react";
import { useMapStore } from "../store/useMapStore";

export default function POIRecommendationStrip() {
  const { suggestedPOIs, suggestionLabel, clearSuggestions, setSelectedPOI } =
    useMapStore();

  return (
    <AnimatePresence>
      {suggestedPOIs.length > 0 && (
        <motion.div
          key="poi-strip"
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="absolute bottom-24 left-0 right-0 pointer-events-auto z-50"
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-5 mb-2">
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#4fc3f7" }}
            >
              {suggestionLabel}
            </span>
            <button
              onClick={clearSuggestions}
              className="p-1.5 rounded-full transition-colors hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5 text-white/50" />
            </button>
          </div>

          {/* Horizontal scroll strip */}
          <div className="flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
            {suggestedPOIs.map((poi) => (
              <button
                key={poi.placeId}
                onClick={() => {
                  setSelectedPOI({
                    name: poi.name,
                    category: poi.category,
                    address: poi.address,
                    distance: poi.distance,
                    location: { lat: poi.lat, lng: poi.lng },
                    placeId: poi.placeId,
                    photo: poi.photo,
                  });
                  clearSuggestions();
                }}
                className="shrink-0 flex flex-col overflow-hidden rounded-2xl transition-all active:scale-95"
                style={{
                  width: 140,
                  background: "rgba(0,0,0,0.75)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(12px)",
                }}
              >
                {/* Photo */}
                <div className="w-full h-20 relative overflow-hidden bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      poi.photo ||
                      `https://loremflickr.com/280/160/${encodeURIComponent(poi.category || "place")}`
                    }
                    alt={poi.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>

                {/* Info */}
                <div className="px-2.5 py-2 flex flex-col gap-0.5">
                  <p className="text-xs font-semibold text-white leading-tight line-clamp-2">
                    {poi.name}
                  </p>
                  {poi.distance != null && (
                    <p className="flex items-center gap-1 text-[10px] text-white/40">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      {poi.distance < 1000
                        ? `${Math.round(poi.distance / 10) * 10}m`
                        : `${(poi.distance / 1000).toFixed(1)}km`}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
