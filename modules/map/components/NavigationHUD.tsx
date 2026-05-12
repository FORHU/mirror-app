"use client";

import React, { useMemo } from "react";
import { useMapStore } from "../store/useMapStore";
import {
  Navigation, Zap, X, Locate, Map,
  CornerUpLeft, CornerUpRight, ArrowUp, CornerLeftUp, CornerRightUp, GitMerge, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const NavigationHUD = () => {
  const {
    activeRoute, destination,
    isNavigating, stopNavigation, gpsStatus, deviceType,
    currentStepIndex, distanceToNextManeuver, remainingDistance, remainingDuration,
    cameraMode, setCameraMode
  } = useMapStore();

  const steps = activeRoute?.routes?.[0]?.legs?.[0]?.steps || [];
  const currentStep = steps[currentStepIndex] || null;
  const isArrival = steps.length > 0 && currentStepIndex >= steps.length - 1 && distanceToNextManeuver < 50;

  const maneuverIcon = useMemo(() => {
    if (!currentStep?.maneuver) return <ArrowUp className="w-14 h-14 text-white" />;
    const { type, modifier } = currentStep.maneuver;
    if (type?.includes('depart') || type?.includes('arrive')) return <Navigation className="w-14 h-14 text-white" />;
    if (type?.includes('merge')) return <GitMerge className="w-14 h-14 text-white" />;
    if (type?.includes('turn')) {
      if (modifier?.includes('left')) return <CornerUpLeft className="w-14 h-14 text-white" />;
      if (modifier?.includes('right')) return <CornerUpRight className="w-14 h-14 text-white" />;
    }
    if (modifier?.includes('left')) return <CornerLeftUp className="w-14 h-14 text-white" />;
    if (modifier?.includes('right')) return <CornerRightUp className="w-14 h-14 text-white" />;
    return <ArrowUp className="w-14 h-14 text-white" />;
  }, [currentStep]);

  const formatDistance = (meters: number) => {
    const miles = meters * 0.000621371;
    if (miles < 0.1) return { value: Math.round(meters * 3.28084), unit: "ft" };
    return { value: miles.toFixed(1), unit: "mi" };
  };

  const nextManeuverDist = formatDistance(distanceToNextManeuver);

  const eta = useMemo(() => {
    if (!remainingDuration) return "--:--";
    const date = new Date(Date.now() + remainingDuration * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(' AM', '').replace(' PM', '');
  }, [remainingDuration]);

  const totalDistance = activeRoute?.routes?.[0]?.distance || 0;
  const progressPercent = totalDistance > 0 ? ((totalDistance - remainingDistance) / totalDistance) * 100 : 0;
  const formattedRemainingMiles = (remainingDistance * 0.000621371).toFixed(0);
  const batteryAtArrival = Math.max(5, 65 - (remainingDistance * 0.000621371 * 0.3)).toFixed(0);

  if (!isNavigating) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 p-6 font-sans hud-container">
      <AnimatePresence>
        
        {/* GPS Signal Lost Warning */}
        {gpsStatus === 'lost' && deviceType === 'phone' && (
           <motion.div
             key="gps-warning"
             initial={{ y: -20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: -20, opacity: 0 }}
             className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-600 px-6 py-3 rounded-full flex items-center gap-3 shadow-xl pointer-events-auto"
           >
              <AlertTriangle className="w-6 h-6 text-white" />
              <span className="text-xl font-bold text-white">GPS Signal Lost</span>
           </motion.div>
        )}

        {/* Top Instruction Card / Arrival Card */}
        {activeRoute && destination && (
          <motion.div
            key="instruction-card"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-auto sm:w-[480px] pointer-events-auto"
          >
            {isArrival ? (
              <div className="relative overflow-hidden" style={{ textShadow: "var(--hud-text-shadow)" }}>
                 <div className="flex items-center gap-4 sm:gap-6 relative z-10">
                    <div className="p-4 sm:p-5">
                      <Navigation className="w-10 h-10 sm:w-14 sm:h-14" style={{ color: "var(--hud-icon-stroke)", fill: "var(--hud-icon-stroke)" }} />
                    </div>
                    <div>
                      <div className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--hud-text-primary)" }}>You have arrived</div>
                      <div className="text-lg sm:text-xl font-semibold mt-1 truncate max-w-[200px] sm:max-w-[300px]" style={{ color: "var(--hud-text-secondary)" }}>
                        {destination.place_name.split(',')[0]}
                      </div>
                    </div>
                 </div>
              </div>
            ) : currentStep ? (
              <div className="overflow-hidden relative" style={{ textShadow: "var(--hud-text-shadow)" }}>
                 <div className="flex items-center gap-4 sm:gap-8 relative z-10">
                    <div className="p-4 sm:p-5 [&>svg]:w-10 [&>svg]:h-10 [&>svg]:sm:w-14 [&>svg]:sm:h-14" style={{ color: "var(--hud-icon-stroke)" }}>
                      {maneuverIcon}
                    </div>
                    <div>
                      <div className="text-[28px] font-bold tracking-tight" style={{ color: "var(--hud-text-primary)" }}>
                        {nextManeuverDist.value} <span className="opacity-70">{nextManeuverDist.unit}</span>
                      </div>
                      <div className="text-[16px] font-normal mt-1" style={{ color: "var(--hud-text-secondary)" }}>
                        {currentStep.name || currentStep.maneuver?.instruction || "Proceed"}
                      </div>
                    </div>
                 </div>
              </div>
            ) : null}
          </motion.div>
        )}

        {/* High-Fidelity Bottom Tray (EV Progress Style) */}
        {activeRoute && destination && (
          <motion.div
            key="bottom-tray"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-4 left-4 right-4 sm:bottom-12 sm:left-6 sm:right-auto pointer-events-auto"
            style={{ textShadow: "var(--hud-text-shadow)" }}
          >
            <div className="w-full sm:min-w-[500px] relative p-4">

               <button
                 onClick={() => stopNavigation()}
                 className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 p-3 sm:p-4 rounded-full transition-transform active:scale-95"
                 style={{ border: "var(--hud-border-subtle)", background: "transparent" }}
               >
                 <X className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--hud-icon-stroke)" }} />
               </button>

               <button
                 onClick={() => setCameraMode(cameraMode === 'overview' ? 'follow' : 'overview')}
                 className="absolute -top-3 -left-3 sm:-top-4 sm:-left-4 p-3 sm:p-4 rounded-full transition-transform active:scale-95"
                 style={{ border: "var(--hud-border-subtle)", background: "transparent" }}
               >
                 {cameraMode === 'overview'
                   ? <Locate className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--hud-icon-stroke)" }} />
                   : <Map className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "var(--hud-icon-stroke)" }} />
                 }
               </button>

               <div className="flex items-center justify-between mb-6 sm:mb-8 px-1 sm:px-2">
                  <div className="flex flex-col">
                    <span className="text-[26px] font-bold leading-none" style={{ color: "var(--hud-text-primary)" }}>{eta}</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest mt-1 sm:mt-2" style={{ color: "var(--hud-text-label)" }}>arrival</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[26px] font-bold leading-none" style={{ color: "var(--hud-text-primary)" }}>{formattedRemainingMiles} MI</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest mt-1 sm:mt-2" style={{ color: "var(--hud-text-label)" }}>distance</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Zap className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: "#facc15", opacity: 0.85, fill: "#facc15" }} />
                      <span className="text-[26px] font-bold leading-none" style={{ color: "var(--hud-text-primary)" }}>{batteryAtArrival}%</span>
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-widest mt-1 sm:mt-2" style={{ color: "var(--hud-text-label)" }}>on arrival</span>
                  </div>
               </div>
               
               {/* EV Progress Line */}
               <div className="relative h-1 rounded-full mx-2" style={{ background: "var(--hud-progress-track)" }}>
                  <div 
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${progressPercent}%`, background: "var(--hud-progress-fill)" }}
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition-all duration-1000"
                    style={{ left: `calc(${progressPercent}% - 8px)`, background: "var(--hud-text-primary)" }}
                  >
                  </div>
               </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
