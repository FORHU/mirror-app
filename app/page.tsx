"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import '../styles/glow.css';
import WeatherWidget from '@/components/WeatherWidget';
import { detectMirrorId } from "@/modules/shared/constants/mirrors";

const TAGLINES = [
  { line1: "The mirror",    line2: "has opinions."  },
  { line1: "Dressed for",   line2: "the moment."    },
  { line1: "Every outfit,", line2: "considered."    },
  { line1: "Step out",      line2: "with intent."   },
  { line1: "Wear the",      line2: "right thing."   },
];

export default function WelcomePage() {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

<<<<<<< HEAD
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
=======
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        try {
          localStorage.setItem('mirror_weather_coords', JSON.stringify({
            lat: coords.latitude,
            lon: coords.longitude,
            at: Date.now(),
          }));
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, []);
>>>>>>> f83bacda35d558827b52f988fe63295c55bdfedd

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
      setDate(now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
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
      onClick={() => router.push(`/qrcode/${detectMirrorId()}`)}
    >

<<<<<<< HEAD
      <div className="relative z-10">

        {/* Hero Section */}
        <section className="pt-24 pb-16 px-6 text-center max-w-5xl mx-auto flex items-center justify-center h-screen">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >

            <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-[1.1] tracking-tight bg-gradient-to-r from-[#6b5b95] via-[#8b7fc7] to-[#6b5b95] bg-clip-text text-transparent">
              Welcome to <br />
              Smart Mirror.
            </h1>
            <p className="text-xl text-[#6b5b95] max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
              Click &quot;Start now&quot; to get started experiencing the future of smart mirrors.
            </p>

            <div className= "flex flex-col md:flex-row items-center justify-center gap-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                onClick={() => router.push("/qrcode")}
                className="w-full py-4 bg-gradient-to-r from-[#8b7fc7] to-[#ffa07a] shadow-lg shadow-purple-300/40 text-[#2d2d3a] font-semibold rounded-xl shadow-lg hover:shadow-purple-400/60 transition-all flex items-center justify-center gap-2"
              >
                Start Now
              </motion.button>
            </div>
          </motion.div>
        </section>
=======
      {/* Header */}
      <div className="flex items-center shrink-0 py-4 px-4 mb-6">
        <div style={{ flex: '0 0 25%', width: '25%', display: 'flex', alignItems: 'center' }}>
          <WeatherWidget iconSize={32} />
        </div>
        <div style={{ flex: '0 0 50%', width: '50%', display: 'flex', justifyContent: 'center' }}>
          <span className="text-white font-semibold text-3xl tracking-wide select-none">StyleOS</span>
        </div>
        <div style={{ flex: '0 0 25%', width: '25%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <p className="text-white font-semibold text-2xl leading-tight">{time}</p>
          <p className="text-white/40 text-sm mt-0.5">{date}</p>
        </div>
>>>>>>> f83bacda35d558827b52f988fe63295c55bdfedd
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
            <span className="text-white font-extrabold tracking-tight leading-none select-none" style={{ fontSize: 96 }}>
              {TAGLINES[activeIndex].line1}
            </span>
            <span className="text-white/30 font-extrabold tracking-tight leading-none select-none" style={{ fontSize: 96 }}>
              {TAGLINES[activeIndex].line2}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4 shrink-0">
        <button
          className="w-full py-8 text-white font-bold text-2xl transition-all active:scale-95"
          onClick={() => router.push(`/qrcode/${detectMirrorId()}`)}
        >
          Touch to Start Now
        </button>
      </div>

    </div>
  );
}
