"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import "../styles/glow.css";
import WeatherWidget from "@/components/WeatherWidget";
import { detectMirrorId } from "@/modules/shared/constants/mirrors";
import { ROUTES } from "@/navigation";

const TAGLINES = [
  { line1: "The mirror", line2: "has opinions." },
  { line1: "Dressed for", line2: "the moment." },
  { line1: "Every outfit,", line2: "considered." },
  { line1: "Step out", line2: "with intent." },
  { line1: "Wear the", line2: "right thing." },
];

export default function WelcomePage() {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        try {
          localStorage.setItem(
            "mirror_weather_coords",
            JSON.stringify({
              lat: coords.latitude,
              lon: coords.longitude,
              at: Date.now(),
            }),
          );
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, []);

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

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % TAGLINES.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="w-screen h-screen bg-black flex flex-col overflow-hidden px-10 py-10 cursor-pointer"
      onClick={() => router.push(`${ROUTES.QRCODE}/${detectMirrorId()}`)}
    >
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

      {/* Taglines */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            className="flex flex-col"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <span
              className="text-white font-extrabold tracking-tight leading-none select-none"
              style={{ fontSize: 96 }}
            >
              {TAGLINES[activeIndex].line1}
            </span>
            <span
              className="text-white/30 font-extrabold tracking-tight leading-none select-none"
              style={{ fontSize: 96 }}
            >
              {TAGLINES[activeIndex].line2}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4 shrink-0">
        <button
          className="w-full py-8 text-white font-bold text-2xl transition-all active:scale-95"
          onClick={() => router.push(`${ROUTES.QRCODE}/${detectMirrorId()}`)}
        >
          Touch to Start Now
        </button>
      </div>
    </div>
  );
}
