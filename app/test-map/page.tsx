import React from "react";
import { MapScene, MapDashboard } from "@/modules/map";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Map Test | Mirror App",
  description: "Minimal test page for Mapbox GL JS integration.",
};

export default function TestMapPage() {
  return (
    <main className="w-screen h-screen bg-black relative">
      <MapScene />
      <MapDashboard />
    </main>
  );
}
