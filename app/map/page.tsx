import React from "react";
import { MapDashboard, MapScene } from "@/modules/map";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Navigation | Mirror App",
  description: "Futuristic 3D map interface for the smart mirror.",
};

export default function MapPage() {
  return (
    <main className="w-screen h-dvh bg-black relative overflow-hidden">
      <MapScene />
      <MapDashboard />
    </main>
  );
}
