"use client";

import React, { useState, useEffect } from "react";
import { Search, MapPin, X, Loader2, Car, Footprints, Bike } from "lucide-react";
import { useMapStore } from "../store/useMapStore";
import { motion, AnimatePresence } from "framer-motion";
import type { GeocodeResult } from "../services/map.service";
import type { TransportProfile } from "../types/map.types";

export default function MapSearch() {
  const [query, setQuery] = useState("");
  const { 
    searchLocations, 
    searchResults, 
    isSearching, 
    setDestination, 
    clearNavigation,
    activeRoute,
    selectedDestination,
    activeProfile,
    setActiveProfile,
    startNavigation,
    isNavigating
  } = useMapStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2 && !selectedDestination) {
        searchLocations(query);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, searchLocations, selectedDestination]);

  const handleSelect = (result: GeocodeResult) => {
    setDestination(result);
    setQuery(result.name);
  };

  const handleClear = () => {
    setQuery("");
    clearNavigation();
  };

  if (isNavigating) return null;

  return (
    <div className="w-[400px] flex flex-col gap-4">
      {/* Search Bar */}
      <div className="relative bg-transparent border border-white/20 rounded-2xl p-2 flex items-center gap-3 backdrop-blur-md">
        <div className="pl-3">
          {isSearching ? <Loader2 className="w-5 h-5 animate-spin text-white/50" /> : <Search className="w-5 h-5 text-white/50" />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Where to?"
          className="flex-1 bg-transparent border-none outline-none py-3 text-white text-lg placeholder:text-white/20"
        />
        {query && (
          <button onClick={handleClear} className="p-2 text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      <AnimatePresence>
        {searchResults.length > 0 && !selectedDestination && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-black/60 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 backdrop-blur-xl"
          >
            {searchResults.map((result) => (
              <button
                key={result.placeId}
                onClick={() => handleSelect(result)}
                className="w-full flex items-start gap-4 p-4 hover:bg-white/5 text-left transition-colors"
              >
                <MapPin className="w-5 h-5 mt-1 text-white/40" />
                <div className="flex-1">
                  <div className="text-white font-medium">{result.name}</div>
                  <div className="text-sm text-white/40 truncate">{result.address}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Route Preview Card */}
      <AnimatePresence>
        {selectedDestination && activeRoute && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-black/40 border border-white/20 rounded-3xl p-6 backdrop-blur-2xl flex flex-col gap-6"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 pr-4">
                <h3 className="text-2xl font-bold text-white leading-tight">{selectedDestination.name}</h3>
                <p className="text-white/40 mt-1">{Math.round(activeRoute.distance / 1000 * 10) / 10} km away</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-light text-white tracking-tighter">
                  {Math.round(activeRoute.duration / 60)}
                </div>
                <div className="text-xs uppercase tracking-widest text-white/30 font-bold">min</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'car', icon: Car, label: 'Car' },
                { id: 'motorcycle', icon: Bike, label: 'Moto' },
                { id: 'bicycle', icon: Bike, label: 'Bike' },
                { id: 'walking', icon: Footprints, label: 'Walk' },
              ].map((mode) => {
                const Icon = mode.icon;
                const active = activeProfile === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setActiveProfile(mode.id as TransportProfile)}
                    className={`flex flex-col items-center gap-2 py-3 rounded-2xl transition-all border ${
                      active 
                        ? 'bg-white/10 border-white text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                        : 'bg-transparent border-white/10 text-white/30 hover:border-white/30'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[8px] uppercase tracking-wider font-black">{mode.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={startNavigation}
              className="w-full py-5 bg-transparent border border-white text-white rounded-2xl font-black text-xl uppercase tracking-[0.3em] hover:bg-white hover:text-black active:scale-[0.98] transition-all duration-300"
            >
              Start Trip
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
