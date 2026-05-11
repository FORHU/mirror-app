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

export const MapDashboard = () => {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col h-full p-6">
      {/* Header */}
        {/* Header */}
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex justify-between items-center pointer-events-auto"
        >
          <Button 
            variant="glass" 
            size="sm" 
            onClick={() => router.back()}
            className="rounded-full px-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <MapSearch />

          <Card className="py-2 px-6 rounded-full flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             <span className="text-xs font-mono uppercase tracking-widest opacity-70">System Active: Map Engine v3.0</span>
          </Card>
        </motion.div>

        {/* Navigation Overlays */}
        <NavigationHUD />

        {/* Floating Sidebar Controls (Bottom Left) */}
        <div className="mt-auto mb-12 flex flex-col gap-4 pointer-events-auto">
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card variant="glass" className="w-64 backdrop-blur-xl border-white/10">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Navigation2 className="w-4 h-4 text-primary" />
                Navigation Core
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-[10px] uppercase opacity-50 mb-1">Current Sector</div>
                  <div className="text-sm font-mono">Seoul-Central_S01</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-xs py-2 h-auto">
                    <Layers className="w-3 h-3 mr-1" />
                    Layers
                  </Button>
                  <Button variant="outline" className="flex-1 text-xs py-2 h-auto">
                    <Cpu className="w-3 h-3 mr-1" />
                    Stats
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card variant="glass" className="w-64 backdrop-blur-xl border-white/10 p-4">
              <div className="flex items-center justify-between text-[10px] uppercase opacity-50">
                <span>GPU Usage</span>
                <span>42%</span>
              </div>
              <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "42%" }}
                  className="h-full bg-primary"
                />
              </div>
            </Card>
          </motion.div>
        </div>
    </div>
  );
};
