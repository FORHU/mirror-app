"use client";

import React, { useState, useEffect } from "react";
import { Search, MapPin, Navigation, X, Loader2 } from "lucide-react";
import { useMapStore } from "../store/useMapStore";
import { Card } from "@/modules/shared/components/Card";
import { motion, AnimatePresence } from "framer-motion";

export const MapSearch = () => {
  const [query, setQuery] = useState("");
  const isSelectingRef = React.useRef(false);
  const { searchLocations, searchResults, isSearching, setDestination, clearNavigation } = useMapStore();

  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (query.length > 2) {
        searchLocations(query);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, searchLocations]);

  const handleSelect = (result: any) => {
    isSelectingRef.current = true;
    setDestination(result);
    setQuery(result.place_name);
    // Explicitly clear results in case store update is async
    useMapStore.setState({ searchResults: [] });
  };

  const handleClear = () => {
    setQuery("");
    clearNavigation();
  };

  return (
    <div className="w-full max-w-md pointer-events-none">
      <div 
        className="relative p-2 rounded-[2rem] overflow-visible pointer-events-auto"
        style={{ background: "var(--ghost-bg)", border: "var(--ghost-panel-border)" }}
      >
        <div className="flex items-center gap-3 px-4">
          {isSearching ? (
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--ghost-panel-text)" }} />
          ) : (
            <Search className="w-6 h-6" style={{ color: "var(--ghost-panel-text)" }} />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destination..."
            className="flex-1 bg-transparent border-none outline-none py-4 text-lg"
            style={{ color: "var(--ghost-panel-text)" }}
          />
          {query && (
            <button onClick={handleClear} className="p-2 rounded-full" style={{ background: "transparent", border: "var(--ghost-panel-border)" }}>
              <X className="w-5 h-5" style={{ color: "var(--ghost-panel-text)" }} />
            </button>
          )}
        </div>

        {/* Results Dropdown */}
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute left-0 right-0 top-full mt-2 z-50"
            >
              <div className="p-2 overflow-hidden shadow-2xl rounded-3xl mt-2 pointer-events-auto" style={{ background: "var(--ghost-bg)", border: "var(--ghost-panel-border)" }}>
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    className="w-full flex items-start gap-4 p-4 rounded-xl transition-colors text-left"
                    style={{ borderBottom: "var(--ghost-panel-border)" }}
                  >
                    <div className="mt-1 p-2 rounded-lg" style={{ border: "var(--ghost-btn-border)" }}>
                      <MapPin className="w-5 h-5" style={{ color: "var(--ghost-panel-text)" }} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-lg font-medium truncate" style={{ color: "var(--ghost-panel-text)" }}>
                        {result.place_name.split(",")[0]}
                      </div>
                      <div className="text-sm truncate" style={{ color: "var(--ghost-panel-text)", opacity: 0.7 }}>
                        {result.place_name.split(",").slice(1).join(",").trim()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
