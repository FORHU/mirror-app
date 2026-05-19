"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Heart, User, Mic, CloudRain, Calendar, Navigation, MapPin } from "lucide-react";
import { motion } from "motion/react";
import "../../../styles/glow.css";

export default function OutingTemplate() {
  const router = useRouter();
  const [selectedLook, setSelectedLook] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex flex-row p-6 gap-6 justify-between">
      {/* Background reflection image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-screen scale-105 pointer-events-none"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&auto=format&fit=crop&q=80')` }}
      />

      {/* Header back button */}
      <div className="absolute top-8 left-8 z-40">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push("/mirror-templates")}
          className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all backdrop-blur animate-fade-in"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
      </div>

      {/* ── LEFT COLUMN: Voice Styling Assistant ── */}
      <aside className="w-[30%] h-full flex flex-col justify-between py-6 px-4 md:px-5 bg-black/60 backdrop-blur-md border-r border-white/5 rounded-3xl z-20 overflow-y-auto scrollbar-hide">
        {/* Top: Weather Header */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4.5">
            <div className="flex items-center gap-3">
              <CloudRain className="w-7 h-7 text-blue-400 animate-bounce" />
              <div className="flex flex-col text-left">
                <span className="text-white text-lg md:text-xl font-bold">19°C</span>
                <span className="text-white/40 text-xs font-bold tracking-widest uppercase">Seoul</span>
              </div>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-white text-lg md:text-xl font-extrabold tracking-wide">6:23 PM</span>
              <span className="text-white/40 text-xs font-bold tracking-widest uppercase mt-0.5">Thursday, April 17</span>
            </div>
          </div>

          {/* AI Dialogue */}
          <div className="flex flex-col gap-6 mt-2">
            {/* User Ask */}
            <div className="flex flex-col items-start gap-2">
              <span className="text-white/30 text-[10px] md:text-xs uppercase font-bold tracking-wider">✦ You Asked</span>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none px-4 py-3.5 max-w-[95%]">
                <p className="text-white/90 text-xs md:text-sm font-medium leading-relaxed">
                  I have a birthday dinner party at a downtown Korean restaurant tomorrow at 7 PM. What should I wear?
                </p>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex flex-col items-start gap-2">
              <span className="text-purple-400 text-[10px] md:text-xs uppercase font-bold tracking-wider">✦ AI Answer</span>
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl rounded-tl-none px-4.5 py-4 max-w-[98%]">
                <p className="text-white/80 text-xs md:text-sm font-medium leading-relaxed">
                  Tomorrow evening will bring light rain, with a temperature around 19°C. It might feel a bit chilly, so I recommend an outfit that&apos;s stylish yet warm enough for the weather.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Voice Control */}
        <div className="flex flex-col items-center gap-3.5 border-t border-white/5 pt-6 mt-6">
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 hover:text-white hover:bg-purple-500/20 hover:border-purple-400/30 transition-all cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.15)]"
          >
            <Mic className="w-6 h-6" />
          </motion.button>
          <span className="text-white/30 text-xs font-bold uppercase tracking-widest select-none">
            Anything else you&apos;d like to know?
          </span>
        </div>
      </aside>

      {/* ── CENTER SECTION: Reflection Guide ── */}
      <section className="flex-1 h-full flex flex-col justify-end items-center py-6 z-10 relative">
        {/* Reflection Box Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="border border-dashed border-white/20 rounded-[100px] w-[280px] md:w-[320px] h-[560px] md:h-[680px] relative" />
        </div>

        {/* Bottom Nav Bar */}
        <div 
          className="flex items-center justify-center gap-12 px-10 py-4 rounded-full border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-20"
          style={{ background: "rgba(255, 255, 255, 0.04)", backdropFilter: "blur(12px)" }}
        >
          <button onClick={() => router.push("/mirror-templates")} className="text-white/60 hover:text-white hover:scale-110 active:scale-95 transition-all p-2.5">
            <Home className="w-6 h-6" />
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <button className="text-white/60 hover:text-white hover:scale-110 active:scale-95 transition-all p-2.5">
            <Heart className="w-6 h-6" />
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <button className="text-white/60 hover:text-white hover:scale-110 active:scale-95 transition-all p-2.5">
            <User className="w-6 h-6" />
          </button>
        </div>
      </section>

      {/* ── RIGHT COLUMN: Recommendations, Calendar, GPS Map ── */}
      <aside className="w-[42%] h-full flex flex-col p-4 gap-5 bg-black/60 backdrop-blur-md border-l border-white/5 rounded-3xl z-20 overflow-y-auto scrollbar-hide">
        {/* Recommendation Cards */}
        <div className="flex flex-col gap-3">
          <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest px-1">Outfit Recommendations</span>
          <div className="grid grid-cols-2 gap-4">
            {/* LOOK 1 */}
            <div 
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                selectedLook === "look1" 
                  ? "bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]" 
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex flex-col gap-2.5">
                <span className="text-xs text-purple-400 font-extrabold uppercase tracking-widest">Look 1</span>
                <span className="text-white text-sm font-bold -mt-1 block">Elegant & Timeless</span>
                <div className="aspect-[4/5] rounded-xl overflow-hidden my-2.5 border border-white/10">
                  <img src="https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=200&auto=format&fit=crop" className="w-full h-full object-cover" />
                </div>
                {/* Accessory icons */}
                <div className="flex gap-3 items-center justify-center py-1.5 border-y border-white/5">
                  <span className="text-sm">💍</span>
                  <span className="text-sm">⌚</span>
                  <span className="text-sm">👠</span>
                </div>
                <ul className="text-xs text-white/50 space-y-1 mt-1 font-light leading-relaxed">
                  <li>• Classic trench coat for a sleek look</li>
                  <li>• Wide-leg pants for comfort & style</li>
                  <li>• Neutral tones for an elegant vibe</li>
                </ul>
              </div>
              <button 
                onClick={() => setSelectedLook("look1")}
                className="w-full mt-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-white/5 border border-white/10 text-white hover:bg-purple-500/20 hover:border-purple-400/40 transition-all cursor-pointer"
              >
                {selectedLook === "look1" ? "Selected" : "Select This Look"}
              </button>
            </div>

            {/* LOOK 2 */}
            <div 
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                selectedLook === "look2" 
                  ? "bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]" 
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex flex-col gap-2.5">
                <span className="text-xs text-purple-400 font-extrabold uppercase tracking-widest">Look 2</span>
                <span className="text-white text-sm font-bold -mt-1 block">Chic & Modern</span>
                <div className="aspect-[4/5] rounded-xl overflow-hidden my-2.5 border border-white/10">
                  <img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=200&auto=format&fit=crop" className="w-full h-full object-cover" />
                </div>
                {/* Accessory icons */}
                <div className="flex gap-3 items-center justify-center py-1.5 border-y border-white/5">
                  <span className="text-sm">👑</span>
                  <span className="text-sm">⌚</span>
                  <span className="text-sm">🥾</span>
                </div>
                <ul className="text-xs text-white/50 space-y-1 mt-1 font-light leading-relaxed">
                  <li>• Warm brown tones add sophistication</li>
                  <li>• Pleated skirt for a feminine touch</li>
                  <li>• Ankle boots keep you warm & stylish</li>
                </ul>
              </div>
              <button 
                onClick={() => setSelectedLook("look2")}
                className="w-full mt-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-white/5 border border-white/10 text-white hover:bg-purple-500/20 hover:border-purple-400/40 transition-all cursor-pointer"
              >
                {selectedLook === "look2" ? "Selected" : "Select This Look"}
              </button>
            </div>
          </div>
        </div>

        {/* Your Plan (Timeline) */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2 px-1 justify-between">
            <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest">Your Plan</span>
            <Calendar className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex flex-col gap-3 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            {/* Event 1 */}
            <div className="flex gap-3.5 border-l-2 border-purple-500 pl-3.5">
              <span className="text-purple-400 text-sm font-bold shrink-0 mt-0.5">07:00 PM</span>
              <div className="flex flex-col">
                <span className="text-white text-sm font-bold">Birthday Dinner</span>
                <span className="text-white/40 text-xs mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Seoul Korean House, 123 Main St, Seoul
                </span>
              </div>
            </div>

            {/* Event 2 */}
            <div className="flex gap-3.5 border-l-2 border-pink-500 pl-3.5 mt-2">
              <span className="text-pink-400 text-sm font-bold shrink-0 mt-0.5">09:30 PM</span>
              <div className="flex flex-col">
                <span className="text-white text-sm font-bold">Dessert & Coffee</span>
                <span className="text-white/40 text-xs mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Cafe Layered, 456 Cafe St, Seoul
                </span>
              </div>
            </div>
            
            <button className="w-full mt-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer">
              Add to Calendar
            </button>
          </div>
        </div>

        {/* GPS Routing Dark Map */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2 px-1 justify-between">
            <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest">Navigation Map</span>
            <Navigation className="w-4 h-4 text-purple-400 animate-pulse" />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3.5 relative overflow-hidden backdrop-blur-md">
            {/* Styled Map Graphic Illustration */}
            <div className="h-32 rounded-xl bg-black/80 border border-white/5 relative overflow-hidden flex items-center justify-center p-2">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,white_1px,transparent_1px)] bg-[size:10px_10px]" />
              
              {/* Route line */}
              <svg className="w-full h-full absolute inset-0 z-10" strokeLinecap="round">
                <path d="M 40 80 Q 120 20 180 60 T 260 30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                <path 
                  d="M 40 80 Q 120 20 180 60 T 260 30" 
                  fill="none" 
                  stroke={isNavigating ? "#a855f7" : "rgba(168,85,247,0.4)"} 
                  strokeWidth="3.5"
                  className={isNavigating ? "animate-pulse" : ""}
                />
                
                {/* Starting point node */}
                <circle cx="40" cy="80" r="4" fill="#a855f7" />
                <circle cx="40" cy="80" r="8" fill="none" stroke="#a855f7" strokeWidth="1" className="animate-ping" />
                
                {/* Ending point node */}
                <circle cx="260" cy="30" r="4" fill="#ec4899" />
                <circle cx="260" cy="30" r="8" fill="none" stroke="#ec4899" strokeWidth="1" className="animate-ping" />
              </svg>
              <div className="absolute z-20 left-4 top-4 bg-purple-500/20 border border-purple-400/40 rounded px-2.5 py-0.5 text-[10px] uppercase font-bold text-purple-300">
                Route Map
              </div>
            </div>

            {/* Travel Metadata */}
            <div className="flex justify-between items-center px-1">
              <div className="flex flex-col">
                <span className="text-xs text-white/40 uppercase font-bold">Duration</span>
                <span className="text-white text-base font-extrabold mt-0.5">32 min <span className="text-white/40 font-medium text-xs">(7.8 km)</span></span>
              </div>
              <div className="text-right">
                <span className="text-xs text-white/40 uppercase font-bold">Traffic</span>
                <span className="text-amber-400 text-xs font-bold mt-0.5 block">Moderate Traffic</span>
              </div>
            </div>

            <button 
              onClick={() => setIsNavigating(!isNavigating)}
              className={`w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer select-none ${
                isNavigating 
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_2px_15px_rgba(168,85,247,0.3)] animate-pulse" 
                  : "bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-purple-400/40"
              }`}
            >
              {isNavigating ? "Navigation Active" : "Start Navigation"}
            </button>
          </div>
        </div>
      </aside>
    </main>
  );
}
