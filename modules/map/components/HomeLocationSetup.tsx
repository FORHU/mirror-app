"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMapStore } from "../store/useMapStore";
import { mapService, GeocodeResult } from "../services/map.service";
import { Search, MapPin, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import mapboxgl from "mapbox-gl";

const HomeLocationSetup = () => {
  const [tab, setTab] = useState<'search' | 'pin'>('search');
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const saveHomeLocation = useMapStore((state) => state.saveHomeLocation);

  // Pin drop map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [pinCoords, setPinCoords] = useState<{ lat: number, lng: number }>({ lat: 14.5995, lng: 120.9842 });

  useEffect(() => {
    if (tab === 'pin' && mapContainerRef.current) {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [pinCoords.lng, pinCoords.lat],
        zoom: 12,
      });

      map.on('move', () => {
        const center = map.getCenter();
        setPinCoords({ lat: center.lat, lng: center.lng });
      });

      return () => map.remove();
    }
  }, [tab]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 3) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await mapService.geocode(query);
        setResults(data.results);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSave = async (coords: { lat: number, lng: number }) => {
    setIsSaving(true);
    setError(null);
    try {
      await saveHomeLocation(coords);
      setSaveSuccess(true);
    } catch (err) {
      setError("Failed to save location. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (saveSuccess) {
    return (
      <div className="fixed inset-0 bg-[#000000] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
            <Check className="w-10 h-10 text-white" />
          </div>
          <span className="text-white/70">Home location set</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#000000] flex flex-col p-10 text-white">
      <div className="mb-12">
        <h1 className="text-4xl font-light mb-2 tracking-tight">System Setup</h1>
        <p className="text-white/40">Set your mirror's home location to begin</p>
      </div>

      <div className="flex gap-8 mb-10 border-b border-white/10 pb-4">
        <button 
          onClick={() => setTab('search')}
          className={`text-lg transition-colors ${tab === 'search' ? 'text-white' : 'text-white/30'}`}
        >
          Search Address
        </button>
        <button 
          onClick={() => setTab('pin')}
          className={`text-lg transition-colors ${tab === 'pin' ? 'text-white' : 'text-white/30'}`}
        >
          Pin Drop
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'search' ? (
          <div className="flex flex-col h-full">
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                autoFocus
                type="text"
                placeholder="Search city or street..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-white/20 transition-colors"
              />
              {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-white/20" />}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {results.map((res) => (
                <button
                  key={res.placeId}
                  onClick={() => handleSave({ lat: res.lat, lng: res.lng })}
                  className="w-full text-left p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                >
                  <div className="font-medium text-white/90">{res.name}</div>
                  <div className="text-sm text-white/40">{res.address}</div>
                </button>
              ))}
              {query.length >= 3 && results.length === 0 && !isSearching && (
                <div className="text-center py-10 text-white/20">No results found</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/10 mb-6">
              <div ref={mapContainerRef} className="w-full h-full" />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <MapPin className="w-8 h-8 text-white drop-shadow-2xl -translate-y-4" />
              </div>
            </div>
            
            <div className="flex justify-between items-center bg-white/5 rounded-xl p-4 border border-white/10 mb-6">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-white/30 tracking-widest">Coordinates</span>
                <span className="font-mono text-white/70">{pinCoords.lat.toFixed(6)}, {pinCoords.lng.toFixed(6)}</span>
              </div>
              <button
                onClick={() => handleSave(pinCoords)}
                disabled={isSaving}
                className="bg-white text-black px-8 py-3 rounded-xl font-medium hover:bg-white/90 transition-colors flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set Home"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}
    </div>
  );
};

export default HomeLocationSetup;
