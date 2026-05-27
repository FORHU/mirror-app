"use client";

import { useAmbientPOI } from "../hooks/useAmbientPOI";
import AmbientPOICard from "./AmbientPOICard";

const NavigationHUD = () => {
  const { ambientPOI, dismissAmbientPOI } = useAmbientPOI();

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {/* ── Bottom-left: Ambient POI (offset right of NavCard) ── */}
      <div className="absolute left-6 bottom-44">
        <AmbientPOICard poi={ambientPOI} onDismiss={dismissAmbientPOI} />
      </div>
    </div>
  );
};

export default NavigationHUD;
