"use client";

import { useEffect, useRef } from "react";
import { useMapStore } from "../store/useMapStore";
import NavigationHUD from "./NavigationHUD";
import { ExploreHUD } from "./ExploreHUD";
import MapViewport from "./MapViewport";
import CommuteWidget from "./CommuteWidget";
import WeatherWidget from "./WeatherWidget";

export default function MapDashboard() {
  const { isNavigating } = useMapStore();
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const mirrorCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        const video = hiddenVideoRef.current!;
        video.srcObject = s;
        video.play().catch(() => {});

        const drawFrame = () => {
          const canvas = mirrorCanvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (canvas && ctx && video.readyState >= 2) {
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
            ctx.save();
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, w, h);
            ctx.restore();
          }
          rafRef.current = requestAnimationFrame(drawFrame);
        };

        rafRef.current = requestAnimationFrame(drawFrame);
      })
      .catch(() => {});

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden">
      {/* Hidden camera source */}
      <video ref={hiddenVideoRef} autoPlay muted playsInline className="hidden" />

      {/* Mirror canvas — drawn via RAF, stays on main thread, avoids GPU layer isolation */}
      <canvas ref={mirrorCanvasRef} className="absolute inset-0 w-full h-full" />

      {/* Tint layer */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Map — screen blend: black areas become transparent, roads/labels float over reflection */}
      <div className="absolute inset-0" style={{ mixBlendMode: "screen" }}>
        <MapViewport />
      </div>

      {/* Top-left cluster: weather + commute — stacked, no overlap */}
      {!isNavigating && (
        <div className="absolute top-6 left-6 z-50 pointer-events-auto flex flex-col gap-1">
          <WeatherWidget />
          <CommuteWidget />
        </div>
      )}

      {isNavigating && <NavigationHUD />}
      <ExploreHUD />
    </div>
  );
}
