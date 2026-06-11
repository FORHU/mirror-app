"use client";

import { Car, Bike, PersonStanding } from "lucide-react";
import { useMapStore } from "../store/useMapStore";
import type { TransportProfile } from "../types/map.types";
import { motion } from "motion/react";

export default function ProfileSelector() {
  const { activeProfile, setActiveProfile } = useMapStore();

  const profiles: { id: TransportProfile; icon: typeof Car; label: string }[] =
    [
      { id: "car", icon: Car, label: "Car" },
      { id: "motorcycle", icon: Bike, label: "Moto" },
      { id: "bicycle", icon: Bike, label: "Bike" },
      { id: "walking", icon: PersonStanding, label: "Walk" },
    ];

  return (
    <div className="flex items-center gap-4">
      {profiles.map((profile) => {
        const Icon = profile.icon;
        const isActive = activeProfile === profile.id;

        return (
          <button
            key={profile.id}
            onClick={() => setActiveProfile(profile.id)}
            className="relative flex flex-col items-center group p-2 focus:outline-none"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Icon
              size={22}
              stroke={isActive ? "#4fc3f7" : "rgba(255,255,255,0.35)"}
              className="transition-colors group-hover:stroke-[rgba(255,255,255,0.65)]"
            />
            {isActive && (
              <motion.div
                layoutId="profile-indicator"
                className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#4fc3f7]"
              />
            )}
            <span className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white/50 uppercase tracking-widest whitespace-nowrap">
              {profile.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
