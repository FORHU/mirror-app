"use client";

import React from "react";
import { MapScene } from "./MapScene";
import { Card } from "@/modules/shared/components/Card";
import { Button } from "@/modules/shared/components/Button";
import { ArrowLeft, Navigation2, Layers, Cpu } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MapSearch } from "./MapSearch";
import { NavigationHUD } from "./NavigationHUD";
import { ExploreHUD } from "./ExploreHUD";
import { useMapStore } from "../store/useMapStore";

export const MapDashboard = () => {
  const router = useRouter();
  const { isNavigating } = useMapStore();

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col h-full p-6">
      {/* Header */}
      {!isNavigating ? (
        <>
          {/* Header */}
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex justify-between items-center pointer-events-none"
          >
            <Button 
              variant="glass" 
              size="sm" 
              onClick={() => router.back()}
              className="rounded-full px-4 pointer-events-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <div className="pointer-events-none w-full max-w-md mx-4">
              <MapSearch />
            </div>

            <Card className="py-2 px-6 rounded-full flex items-center gap-3 pointer-events-auto">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
               <span className="text-xs font-mono uppercase tracking-widest opacity-70">System Active: Map Engine v3.0</span>
            </Card>
          </motion.div>

          {/* Explore Overlays */}
          <ExploreHUD />

        {/* Floating Sidebar Controls (Bottom Left) */}
        <div className="mt-auto mb-12 flex flex-col gap-4 pointer-events-none">
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="pointer-events-none"
          >
            <div 
              className="w-64 p-4 rounded-3xl pointer-events-auto"
              style={{ background: "var(--ghost-bg)", border: "var(--ghost-panel-border)", color: "var(--ghost-panel-text)" }}
            >
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Navigation2 className="w-4 h-4" style={{ color: "var(--ghost-btn-icon)" }} />
                Navigation Core
              </h3>
              <div className="space-y-3">
                <div className="p-3 rounded-xl border" style={{ background: "transparent", borderColor: "var(--ghost-panel-border)" }}>
                  <div className="text-[10px] uppercase mb-1" style={{ opacity: 0.5 }}>Current Sector</div>
                  <div className="text-sm font-mono">Seoul-Central_S01</div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 text-xs py-2 h-auto flex items-center justify-center border rounded-lg" style={{ borderColor: "var(--ghost-panel-border)" }}>
                    <Layers className="w-3 h-3 mr-1" />
                    Layers
                  </div>
                  <div className="flex-1 text-xs py-2 h-auto flex items-center justify-center border rounded-lg" style={{ borderColor: "var(--ghost-panel-border)" }}>
                    <Cpu className="w-3 h-3 mr-1" />
                    Stats
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="pointer-events-none"
          >
            <div 
              className="w-64 p-4 rounded-3xl pointer-events-auto"
              style={{ background: "var(--ghost-bg)", border: "var(--ghost-panel-border)", color: "var(--ghost-panel-text)" }}
            >
              <div className="flex items-center justify-between text-[10px] uppercase" style={{ opacity: 0.5 }}>
                <span>GPU Usage</span>
                <span>42%</span>
              </div>
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--ghost-panel-border)" }}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "42%" }}
                  className="h-full"
                  style={{ background: "var(--ghost-panel-text)" }}
                />
              </div>
            </div>
          </motion.div>
        </div>
        </>
      ) : (
        /* Navigation Overlays */
        <NavigationHUD />
      )}
    </div>
  );
};
