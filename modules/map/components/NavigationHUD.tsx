"use client";

import React from "react";
import { useMapStore } from "../store/useMapStore";
import { Card } from "@/modules/shared/components/Card";
import { Navigation, Clock, Map as MapIcon, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const NavigationHUD = () => {
  const { activeRoute, destination } = useMapStore();

  if (!activeRoute || !destination) return null;

  const route = activeRoute?.routes?.[0];
  if (!route) return null; // Wait until route data is actually available

  const duration = Math.round(route.duration / 60);
  const distance = (route.distance / 1000).toFixed(1);
  const nextStep = route.legs?.[0]?.steps?.[0];

  if (!nextStep) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 50, opacity: 0 }}
        className="fixed top-24 right-6 w-80 pointer-events-auto z-50"
      >
        <Card variant="glass" className="p-0 border-white/10 shadow-2xl overflow-hidden">
          {/* Next Step Header */}
          <div className="bg-primary/20 p-4 border-b border-white/5 flex items-center gap-4">
            <div className="p-2 bg-primary rounded-xl">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Next Instruction</div>
              <div className="text-sm font-medium leading-tight">{nextStep.maneuver.instruction}</div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 divide-x divide-white/5 border-b border-white/5">
            <div className="p-4 flex items-center gap-3">
              <Clock className="w-4 h-4 text-primary" />
              <div>
                <div className="text-xs font-bold">{duration} min</div>
                <div className="text-[10px] opacity-50 uppercase">Est. Time</div>
              </div>
            </div>
            <div className="p-4 flex items-center gap-3">
              <MapIcon className="w-4 h-4 text-primary" />
              <div>
                <div className="text-xs font-bold">{distance} km</div>
                <div className="text-[10px] opacity-50 uppercase">Distance</div>
              </div>
            </div>
          </div>

          {/* Destination Summary */}
          <div className="p-4 bg-white/5 flex items-center justify-between">
            <div className="overflow-hidden">
              <div className="text-[10px] opacity-50 uppercase">Destination</div>
              <div className="text-xs font-medium truncate">{destination.place_name.split(",")[0]}</div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-30" />
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};
