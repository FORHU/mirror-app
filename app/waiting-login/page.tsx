"use client";

import { useState, useEffect } from "react";
import WeatherWidget from "@/components/WeatherWidget";

export default function WaitingLoginPage() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      );
      setDate(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden px-10 py-10">
      <style>{`
        @keyframes wl-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes wl-slide { from { opacity: 0; transform: translateY(-20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes wl-dot { 0%, 100% { transform: scale(1); opacity: 0.3 } 50% { transform: scale(1.4); opacity: 1 } }
        .wl-fade-in  { animation: wl-fade  0.5s ease           forwards }
        .wl-slide-in { animation: wl-slide 0.7s cubic-bezier(0.22,1,0.36,1) 0.2s both }
        .wl-dots-in  { animation: wl-fade  0.5s ease 0.5s      both }
        .wl-dot      { animation: wl-dot   1.5s ease-in-out    infinite }
      `}</style>

      {/* Header */}
      <div className="flex items-center shrink-0 py-4 px-4 mb-6">
        <div
          style={{
            flex: "0 0 25%",
            width: "25%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <WeatherWidget iconSize={32} />
        </div>
        <div
          style={{
            flex: "0 0 50%",
            width: "50%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <span className="text-white font-semibold text-3xl tracking-wide select-none">
            StyleOS
          </span>
        </div>
        <div
          style={{
            flex: "0 0 25%",
            width: "25%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <p className="text-white font-semibold text-2xl leading-tight">
            {time}
          </p>
          <p className="text-white/40 text-sm mt-0.5">{date}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center min-h-0 wl-fade-in">
        <div className="flex flex-col items-center text-center gap-10 w-full">
          <div className="wl-slide-in space-y-4">
            <h1
              className="text-white font-bold tracking-tight"
              style={{ fontSize: 72, lineHeight: 1.05 }}
            >
              Waiting to Connect
            </h1>
            <p className="text-white/40 text-xl font-light max-w-lg mx-auto leading-relaxed">
              Your mirror has been scanned. Please complete the onboarding
              process on the other device.
            </p>
          </div>

          <div className="flex items-center gap-3 wl-dots-in">
            {[0, 0.2, 0.4].map((delay) => (
              <div
                key={delay}
                className="wl-dot w-3 h-3 rounded-full bg-white"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
