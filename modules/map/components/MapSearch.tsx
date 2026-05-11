"use client";

import React, { useState, useEffect } from "react";
import { Search, MapPin, Navigation, X, Loader2 } from "lucide-react";
import { useMapStore } from "../store/useMapStore";
import { Card } from "@/modules/shared/components/Card";
import { motion, AnimatePresence } from "framer-motion";

export const MapSearch = () => {
  const [query, setQuery] = useState("");
  const { searchLocations, searchResults, isSearching, setDestination, clearNavigation } = useMapStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2) {
        searchLocations(query);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, searchLocations]);

  const handleSelect = (result: any) => {
    setDestination(result);
    setQuery(result.place_name);
  };

  const handleClear = () => {
    setQuery("");
    clearNavigation();
  };

  return (
    <div className="w-full max-w-md pointer-events-auto">
      <Card variant="glass" className="relative p-2 rounded-2xl border-white/10 overflow-visible">
        <div className="flex items-center gap-3 px-3">
          {isSearching ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-text-muted" />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destination..."
            className="flex-1 bg-transparent border-none outline-none py-3 text-sm placeholder:text-text-muted text-text-primary"
          />
          {query && (
            <button onClick={handleClear} className="p-1 hover:bg-white/10 rounded-full">
              <X className="w-4 h-4 text-text-muted" />
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
              <Card variant="glass" className="p-2 border-white/10 overflow-hidden shadow-2xl">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    className="w-full flex items-start gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-left"
                  >
                    <div className="mt-1 p-2 bg-primary/10 rounded-lg">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {result.place_name.split(",")[0]}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {result.place_name.split(",").slice(1).join(",").trim()}
                      </div>
                    </div>
                  </button>
                ))}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
};
