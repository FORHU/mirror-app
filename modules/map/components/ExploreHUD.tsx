"use client";

import React from "react";
import { useMapStore } from "../store/useMapStore";
import { INITIAL_VIEW_STATE } from "../constants/config";
import { 
  Navigation, 
  Car, Footprints, Bike, MoreHorizontal, MessageSquare, Mic, Loader2,
  Settings, Share2, LocateFixed, CloudRain, X, Compass
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const ExploreHUD = () => {
  const { 
    destination, travelMode, setTravelMode, fetchRoute, 
    isRouting, toggleTraffic, showTraffic, toggleTerrain, showTerrain, userLocation,
    isNavigating, startNavigation, activeRoute,
    selectedPOI, setSelectedPOI, setDestination,
    cameraMode, setCameraMode
  } = useMapStore();

  const handleRecenter = () => {
    const { map, userLocation, origin } = useMapStore.getState();
    const target = userLocation || origin;
    
    if (map && target) {
      map.easeTo({ 
        center: target, 
        zoom: INITIAL_VIEW_STATE.zoom, 
        pitch: INITIAL_VIEW_STATE.pitch, 
        bearing: INITIAL_VIEW_STATE.bearing, 
        duration: 1000 
      });
    }

    // Try to update user location in background
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
          useMapStore.getState().setUserLocation(coords);
        },
        () => console.warn("Geolocation denied or unavailable"),
        { enableHighAccuracy: true }
      );
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 p-6 font-sans">
      {/* Right Sidebar Icons - Adjusted positioning to prevent overlap */}
      <div className="absolute right-4 sm:right-6 top-32 flex flex-col gap-2 sm:gap-4 pointer-events-none">
        <IconButton className="pointer-events-auto" onClick={handleRecenter} icon={<LocateFixed className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--ghost-btn-icon)" }} />} />
        <div className="relative pointer-events-auto">
          <IconButton 
            onClick={() => console.log("Voice Assistant placeholder clicked")} 
            icon={<Mic className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--ghost-btn-icon)" }} />} 
          />
        </div>
        <IconButton className="pointer-events-auto" onClick={toggleTraffic} active={showTraffic} icon={<Settings className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--ghost-btn-icon)" }} />} />
        
        {isNavigating && (
          <IconButton 
            className="pointer-events-auto" 
            onClick={() => setCameraMode(cameraMode === 'follow' ? 'overview' : 'follow')} 
            icon={cameraMode === 'follow' ? <Compass className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--ghost-btn-icon)" }} /> : <Navigation className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--ghost-btn-icon)" }} />} 
            label={cameraMode === 'follow' ? "Overview" : "Follow"}
          />
        )}
      </div>

      {/* POI Details Card */}
      <AnimatePresence>
        {selectedPOI && !isNavigating && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute left-4 sm:left-6 bottom-4 sm:bottom-12 w-[calc(100%-2rem)] sm:w-[400px] pointer-events-auto"
          >
            <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
               <button 
                 onClick={() => setSelectedPOI(null)}
                 className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white z-10 transition-colors"
               >
                 <X className="w-5 h-5" />
               </button>
               
               <div className="w-full h-48 bg-white/5 rounded-2xl overflow-hidden mb-5 relative">
                 <img 
                   src={`https://loremflickr.com/800/600/${encodeURIComponent(selectedPOI.category || 'place')}`} 
                   alt={selectedPOI.name}
                   className="w-full h-full object-cover"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                 <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
                      {selectedPOI.category.replace(/_/g, ' ')}
                    </div>
                    <div className="text-2xl font-bold text-white truncate shadow-black">
                      {selectedPOI.name}
                    </div>
                 </div>
               </div>

               <button
                 onClick={() => {
                   setDestination({
                     id: `poi-${Date.now()}`,
                     place_name: selectedPOI.name,
                     center: selectedPOI.coordinates,
                     geometry: { type: "Point", coordinates: selectedPOI.coordinates },
                     context: []
                   });
                 }}
                 className="w-full text-white py-4 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
                 style={{ 
                   background: "rgba(255,255,255,0.05)", 
                   border: "2px solid rgba(255,255,255,0.8)",
                   boxShadow: "0 0 20px rgba(255,255,255,0.15)",
                   textShadow: "var(--hud-text-shadow)"
                 }}
               >
                 <Navigation className="w-5 h-5 fill-white rotate-90" />
                 Route Here
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Left Weather Panel (Moved from bottom right to prevent overlap) */}
      <div className="absolute top-24 left-4 sm:left-6 flex flex-col items-start gap-4 sm:gap-6 pointer-events-none">
         <motion.div
           initial={{ x: -50, opacity: 0 }}
           animate={{ x: 0, opacity: 1 }}
           className="pointer-events-none"
         >
           <div 
             className="pointer-events-auto rounded-2xl sm:rounded-[2rem] px-4 py-3 sm:px-8 sm:py-5 flex items-center gap-3 sm:gap-4"
             style={{ background: "var(--ghost-bg)", border: "var(--ghost-panel-border)" }}
           >
              <CloudRain className="w-6 h-6 sm:w-10 sm:h-10" style={{ color: "var(--ghost-weather-text)", opacity: "var(--ghost-weather-icon)" }} />
              <div className="flex flex-col">
                 <span className="text-lg sm:text-2xl font-bold leading-none" style={{ color: "var(--ghost-weather-text)" }}>H: 83° L: 67°</span>
              </div>
           </div>
         </motion.div>
      </div>

      {/* Bottom Right Controls (Start Nav, Mode Selector) */}
      <div className="absolute bottom-[160px] sm:bottom-12 right-4 sm:right-6 flex flex-col items-end gap-4 sm:gap-6 pointer-events-none">

         <AnimatePresence>
           {destination && (
              <motion.div
                key="go-panel"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex flex-col items-end gap-4 sm:gap-6 pointer-events-auto"
              >
                {/* Route Stats */}
                {activeRoute && activeRoute.routes && activeRoute.routes[0] && (
                  <div 
                    className="p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] flex gap-6 sm:gap-8"
                    style={{ background: "var(--ghost-bg)", border: "var(--ghost-panel-border)" }}
                  >
                    <div className="flex flex-col items-end">
                      <span className="text-3xl sm:text-5xl font-bold leading-none" style={{ color: "var(--ghost-panel-text)" }}>
                        {Math.ceil(activeRoute.routes[0].duration / 60)}<span className="text-lg sm:text-2xl ml-1">min</span>
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-1 sm:mt-2" style={{ color: "var(--ghost-panel-text)", opacity: 0.6 }}>
                        Duration
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-3xl sm:text-5xl font-bold leading-none" style={{ color: "var(--ghost-panel-text)" }}>
                        {(activeRoute.routes[0].distance * 0.000621371).toFixed(1)}<span className="text-lg sm:text-2xl ml-1">mi</span>
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-1 sm:mt-2" style={{ color: "var(--ghost-panel-text)", opacity: 0.6 }}>
                        Distance
                      </span>
                    </div>
                  </div>
                )}

                {/* Start Navigation Button */}
                <button
                  onClick={() => {
                    if (!activeRoute) {
                      fetchRoute(true);
                    } else {
                      startNavigation();
                    }
                  }}
                  className="text-white px-6 py-4 sm:px-12 sm:py-6 rounded-full sm:rounded-[2rem] text-xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-4 transition-all active:scale-95 mb-2 sm:mb-4"
                  style={{ 
                    background: "rgba(255,255,255,0.1)", 
                    border: "3px solid rgba(255,255,255,0.9)",
                    boxShadow: "0 0 30px rgba(255,255,255,0.2)",
                    textShadow: "var(--hud-text-shadow)"
                  }}
                >
                  {isRouting ? "Calculating..." : (!activeRoute ? "Calculate Route" : "Start Navigation")}
                  <Navigation className="w-6 h-6 sm:w-10 sm:h-10 fill-white rotate-90" />
                </button>
              </motion.div>
           )}
         </AnimatePresence>

         <div className="flex items-center gap-2 sm:gap-4 hidden sm:flex pointer-events-auto">
            <TransportButton active={travelMode === "driving"} onClick={() => setTravelMode("driving")} icon={<Car className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--ghost-btn-icon)" }} />} />
            <TransportButton active={travelMode === "walking"} onClick={() => setTravelMode("walking")} icon={<Footprints className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--ghost-btn-icon)" }} />} />
            <TransportButton active={travelMode === "cycling"} onClick={() => setTravelMode("cycling")} icon={<Bike className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--ghost-btn-icon)" }} />} />
            <IconButton onClick={toggleTerrain} active={showTerrain} icon={<MoreHorizontal className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--ghost-btn-icon)" }} />} />
         </div>
      </div>
    </div>
  );
};

const IconButton = ({ icon, label, onClick, active, className = "" }: { icon: React.ReactNode, label?: string, onClick?: () => void, active?: boolean, className?: string }) => (
  <button 
    onClick={onClick} 
    className={`p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] transition-all flex flex-col items-center justify-center ${active ? 'bg-white/20 scale-95' : 'hover:bg-white/5'} ${className}`}
    style={{ 
      background: active ? "rgba(255,255,255,0.2)" : "var(--ghost-bg)", 
      border: active ? "1px solid rgba(255,255,255,0.5)" : "var(--ghost-btn-border)",
      boxShadow: active ? "0 0 15px rgba(255,255,255,0.1)" : "none"
    }}
  >
    {icon}
    {label && (
      <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-widest mt-1 opacity-70" style={{ color: "var(--ghost-panel-text)" }}>
        {label}
      </span>
    )}
  </button>
);

const TransportButton = ({ active, icon, onClick }: { active: boolean, icon: React.ReactNode, onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={`p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] transition-all ${active ? 'bg-white/20 scale-95' : 'hover:bg-white/5'}`}
    style={{ 
      background: active ? "rgba(255,255,255,0.2)" : "var(--ghost-bg)", 
      border: active ? "1px solid rgba(255,255,255,0.5)" : "var(--ghost-btn-border)",
      boxShadow: active ? "0 0 15px rgba(255,255,255,0.1)" : "none"
    }}
  >
    {icon}
  </button>
);
