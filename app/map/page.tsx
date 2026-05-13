"use client";

import React, { useEffect } from "react";
import { MapDashboard, MapScene } from "@/modules/map";
import { useMapStore } from "@/modules/map/store/useMapStore";
import { Loader2 } from "lucide-react";
import HomeLocationSetup from "@/modules/map/components/HomeLocationSetup";

export default function MapPage() {
  const { 
    homeLocation, 
    homeLocationStatus, 
    loadHomeLocation 
  } = useMapStore();

  useEffect(() => {
    loadHomeLocation();
  }, [loadHomeLocation]);

  if (homeLocationStatus === 'idle' || homeLocationStatus === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#000000] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white opacity-50 animate-spin" />
      </div>
    );
  }

  if (homeLocationStatus === 'error') {
    return (
      <div className="fixed inset-0 bg-[#000000] flex flex-col items-center justify-center text-white p-4">
        <p className="mb-4 text-white/70">Failed to load system state</p>
        <button 
          onClick={() => loadHomeLocation()}
          className="px-6 py-2 border border-white/20 rounded-full hover:bg-white/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (homeLocationStatus === 'loaded' && homeLocation === null) {
    return <HomeLocationSetup />;
  }

  return (
    <main className="w-screen h-dvh bg-black relative overflow-hidden">
      <MapScene />
      <MapDashboard />
    </main>
  );
}
