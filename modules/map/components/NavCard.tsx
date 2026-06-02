"use client";

import { useMapStore } from "../store/useMapStore";
import { AnimatePresence, motion } from "framer-motion";
import { Car, Footprints, Bike } from "lucide-react";

const PANEL = {
  background: "rgba(0,0,0,0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.12)",
} as const;

const BTN_DIM = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
} as const;

const BTN_ACTIVE = {
  background: "rgba(0,0,0,0.95)",
  border: "1.5px solid rgba(255,255,255,0.8)",
} as const;

const TRANSPORT = [
  { profile: "car" as const, Icon: Car },
  { profile: "motorcycle" as const, Icon: Car },
  { profile: "walking" as const, Icon: Footprints },
  { profile: "bicycle" as const, Icon: Bike },
];

export default function NavCard() {
  const { selectedDestination, activeProfile } = useMapStore();

  return (
    <AnimatePresence>
      {selectedDestination && (
        <motion.div
          key="nav-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="rounded-2xl overflow-hidden pointer-events-auto"
          style={PANEL}
        >
          <div className="flex gap-2 p-3">
            {TRANSPORT.map(({ profile, Icon }) => (
              <button
                key={profile}
                onClick={() => useMapStore.getState().setActiveProfile(profile)}
                className="flex items-center justify-center w-12 h-12 rounded-xl transition-all active:scale-95"
                style={activeProfile === profile ? BTN_ACTIVE : BTN_DIM}
              >
                <Icon className="w-5 h-5 text-white/80" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
