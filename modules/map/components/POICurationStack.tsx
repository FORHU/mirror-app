"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { NearbyPOI } from "@/modules/map/services/map.service";

interface Props {
  pois: NearbyPOI[];
  label?: string;
  chatVisible?: boolean;
  onSelect: (poi: NearbyPOI) => void;
}

function POIPhoto({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
      />
    );
  }

  // Placeholder — initials on a gradient
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-neutral-700 to-neutral-900">
      <span className="text-white/60 text-sm font-semibold">{initials}</span>
    </div>
  );
}

export default function POICurationStack({
  pois,
  label,
  chatVisible = false,
  onSelect,
}: Props) {
  const bottomOffset = chatVisible ? "bottom-[220px]" : "bottom-[108px]";

  return (
    <AnimatePresence>
      {pois.length > 0 && (
        <motion.div
          className={`absolute left-3 right-3 z-40 ${bottomOffset}`}
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
        >
          {/* Overlay panel */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(10,10,10,0.88)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 -4px 40px rgba(0,0,0,0.5)",
            }}
          >
            {/* Handle + header */}
            <div className="px-4 pt-3 pb-2">
              <div className="w-8 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              {label && (
                <p className="text-white/40 text-xs font-medium uppercase tracking-widest">
                  {label}
                </p>
              )}
            </div>

            {/* POI cards */}
            <div className="flex flex-col divide-y divide-white/[0.06]">
              {pois.map((poi, i) => (
                <button
                  key={poi.placeId ?? poi.name}
                  onClick={() => onSelect(poi)}
                  className="flex items-center gap-3 px-4 py-3 text-left w-full
                             active:bg-white/5 transition-colors"
                >
                  {/* Photo with number badge */}
                  <div className="relative flex-shrink-0">
                    <POIPhoto src={poi.photo} name={poi.name} />
                    <span
                      className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full
                                 bg-blue-500 border border-black flex items-center
                                 justify-center text-white text-[10px] font-bold"
                    >
                      {i + 1}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate leading-tight">
                      {poi.name}
                    </p>
                    <p className="text-white/45 text-xs truncate mt-0.5">
                      {poi.categoryIcon} {poi.category}
                    </p>
                  </div>

                  {/* Rating + distance */}
                  <div className="flex-shrink-0 text-right pl-2">
                    {poi.rating != null && (
                      <p className="text-yellow-400 text-xs font-semibold">
                        ★ {poi.rating.toFixed(1)}
                      </p>
                    )}
                    {poi.distance != null && (
                      <p className="text-white/40 text-xs mt-0.5">
                        {poi.distance < 1
                          ? `${Math.round(poi.distance * 1000)}m`
                          : `${poi.distance.toFixed(1)}km`}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Bottom safe spacing */}
            <div className="h-2" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
