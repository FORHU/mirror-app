"use client";
/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- kiosk mockup template, external Unsplash thumbs */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Heart, User, Mic, Cloud, Briefcase } from "lucide-react";
import { motion } from "motion/react";
import "../../../styles/glow.css";

const PREVIOUS_PICKS = [
  { id: "p1", img1: "https://images.unsplash.com/photo-1544923246-77307dd654cb?w=150&auto=format&fit=crop", img2: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=150&auto=format&fit=crop" },
  { id: "p2", img1: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=150&auto=format&fit=crop", img2: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=150&auto=format&fit=crop" },
  { id: "p3", img1: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop", img2: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=150&auto=format&fit=crop" },
  { id: "p4", img1: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=150&auto=format&fit=crop", img2: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=150&auto=format&fit=crop" }
];

const OUTFIT_DETAILS = [
  { 
    category: "Top", 
    title: "Tailored Single Button Blazer", 
    bullets: ["Structured fit", "Enhances posture", "Professional look"], 
    src: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=120&auto=format&fit=crop"
  },
  { 
    category: "Top", 
    title: "Silk Blouse", 
    bullets: ["Soft & breathable", "Elegant drape", "All-day comfort"], 
    src: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=120&auto=format&fit=crop"
  },
  { 
    category: "Bottom", 
    title: "Wide-Leg Slacks", 
    bullets: ["Flattering silhouette", "Comfortable fit", "Easy movement"], 
    src: "https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=120&auto=format&fit=crop"
  },
  { 
    category: "Bag", 
    title: "Structured Tote Bag", 
    bullets: ["Clean design", "Spacious", "Work essential"], 
    src: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=120&auto=format&fit=crop"
  },
  { 
    category: "Shoes", 
    title: "Pointed Toe Pumps", 
    bullets: ["Sleek & sharp", "Heel 5cm", "Professional finish"], 
    src: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=120&auto=format&fit=crop"
  },
  { 
    category: "Accessory", 
    title: "Minimal Watch", 
    bullets: ["Classic design", "Time management", "Subtle luxury"], 
    src: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=120&auto=format&fit=crop"
  }
];

const PALETTE = [
  { color: "bg-[#D6C4B0]", label: "Beige" },
  { color: "bg-[#F5F2EB]", label: "Cream" },
  { color: "bg-[#9CA3AF]", label: "Grey" },
  { color: "bg-[#1E293B]", label: "Navy" },
  { color: "bg-[#09090B]", label: "Black" }
];

const REASONS = [
  "Polished and professional for office",
  "Neutral tones for a sophisticated vibe",
  "Comfortable for long work hours",
  "Timeless pieces for versatile styling"
];

export default function OfficeTemplate() {
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState("Office");

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex flex-row justify-between p-6 gap-6">
      {/* Symmetrical background model outline reflection */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-[0.22] mix-blend-screen scale-100 pointer-events-none"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80')` }}
      />

      {/* Header back button */}
      <div className="absolute top-8 left-8 z-40">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push("/mirror-templates")}
          className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all backdrop-blur"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
      </div>

      {/* ── LEFT COLUMN: Previous Picks & Fashion Modes ── */}
      <aside className="w-[28%] h-full flex flex-col p-4 md:p-6 gap-5 bg-black/60 backdrop-blur-md border-r border-white/5 rounded-3xl z-20 overflow-y-auto scrollbar-hide">
        {/* Tab section */}
        <div className="flex flex-col gap-3 border-b border-white/5 pb-5">
          <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest px-1">Fashion Mode</span>
          <div className="flex flex-col">
            <span className="text-white text-lg md:text-xl font-extrabold tracking-wide uppercase px-1">Office Mode</span>
            <span className="text-white/40 text-xs font-bold tracking-widest px-1 mt-1">Smart • Professional • Confident</span>
          </div>
          
          {/* Sub-tabs pills */}
          <div className="flex gap-2.5 bg-white/5 border border-white/5 rounded-xl p-1.5 mt-3.5">
            {["Office", "Meeting", "Business"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`flex-1 py-2.5 text-xs font-extrabold uppercase tracking-widest rounded-lg transition-all ${
                  activeSubTab === tab 
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_2px_10px_rgba(168,85,247,0.3)]" 
                    : "text-white/45 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Favorites/History header pills */}
          <div className="flex gap-5 mt-4 px-1.5">
            <button className="flex items-center gap-1.5 text-xs font-bold text-white/40 hover:text-white transition-all uppercase tracking-widest">
              <Heart className="w-4 h-4 text-purple-400" /> Favorite
            </button>
            <div className="w-px h-3.5 bg-white/10" />
            <button className="flex items-center gap-1.5 text-xs font-bold text-white/40 hover:text-white transition-all uppercase tracking-widest">
              <span>⏱</span> History
            </button>
          </div>
        </div>

        {/* Previous picks list */}
        <div className="flex flex-col gap-3 flex-1 mt-2">
          <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest px-1">Previous Picks</span>
          <div className="flex flex-col gap-3.5 overflow-y-auto pr-1">
            {PREVIOUS_PICKS.map(item => (
              <div key={item.id} className="grid grid-cols-2 gap-3 p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-400/30 transition-all cursor-pointer relative group">
                <div className="aspect-[4/5] rounded-xl overflow-hidden border border-white/10">
                  <img src={item.img1} className="w-full h-full object-cover group-hover:scale-102 transition-all duration-300" />
                </div>
                <div className="aspect-[4/5] rounded-xl overflow-hidden border border-white/10">
                  <img src={item.img2} className="w-full h-full object-cover group-hover:scale-102 transition-all duration-300" />
                </div>
                <button className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/60 border border-white/10 flex items-center justify-center hover:bg-purple-500/20 hover:border-purple-400/30 transition-all">
                  <Heart className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── CENTER COLUMN: Outfit recommended & target overlay ── */}
      <section className="flex-1 h-full flex flex-col justify-between items-center py-6 z-10 relative">
        {/* Header Weather & clock widgets */}
        <div className="relative z-20 flex justify-between items-start w-full px-6">
          {/* Weather */}
          <div className="flex items-center gap-3 bg-black/30 border border-white/5 px-4 py-2.5 rounded-2xl backdrop-blur-md">
            <Cloud className="w-5 h-5 text-purple-400 animate-pulse" />
            <div className="flex flex-col text-left">
              <span className="text-white text-sm font-semibold">22°C</span>
              <span className="text-white/40 text-xs font-bold uppercase">Seoul</span>
            </div>
          </div>

          {/* Clock */}
          <div className="flex flex-col items-center text-center -mt-2">
            <span className="text-white text-6xl md:text-7xl lg:text-8xl font-extralight tracking-wider">10:30</span>
            <span className="text-white/50 text-sm md:text-base font-light uppercase mt-2">Thursday, April 17</span>
          </div>

          {/* Greeting */}
          <div className="flex flex-col text-right bg-black/30 border border-white/5 px-4 py-2.5 rounded-2xl backdrop-blur-md">
            <span className="text-white text-sm font-semibold">Hello!</span>
            <span className="text-white/40 text-xs font-bold uppercase">Have a nice day</span>
          </div>
        </div>

        {/* Outer overlay description */}
        <div className="flex flex-col items-center text-center relative z-20 max-w-sm mt-4 select-none">
          <span className="text-purple-400 text-xs md:text-sm font-bold uppercase tracking-widest flex items-center gap-2 animate-pulse">
            <Briefcase className="w-4 h-4" /> AI Recommended Outfit
          </span>
          <span className="text-white/60 text-sm md:text-base font-medium mt-1.5">Based on today&apos;s weather and your style</span>
        </div>

        {/* Reflection Guide overlay (Sleek minimalist target frame) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="border border-dashed border-white/20 rounded-[100px] w-[280px] md:w-[320px] h-[560px] md:h-[680px]" />
        </div>

        {/* Voice control micro widget */}
        <div className="flex flex-col items-center gap-2.5 relative z-20 mt-6">
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="w-13 h-13 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 hover:text-white hover:bg-purple-500/20 hover:border-purple-400/30 transition-all cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.1)]"
          >
            <Mic className="w-5 h-5" />
          </motion.button>
          <span className="text-white/30 text-xs font-bold uppercase tracking-widest select-none">
            Ask me anything
          </span>
        </div>

        {/* Bottom Nav Bar */}
        <div 
          className="flex items-center justify-center gap-12 px-10 py-4 rounded-full border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-20 mt-4"
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

      {/* ── RIGHT COLUMN: Recommended Outfit Details, Palette, Why This Look ── */}
      <aside className="w-[40%] h-full flex flex-col p-4 md:p-6 gap-5 bg-black/60 backdrop-blur-md border-l border-white/5 rounded-3xl z-20 overflow-y-auto scrollbar-hide">
        {/* Outfit Details Section */}
        <div className="flex flex-col gap-3">
          <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest px-1">Outfit Details</span>
          <div className="flex flex-col gap-3.5 max-h-[460px] overflow-y-auto pr-1">
            {OUTFIT_DETAILS.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-400/30 transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
                  <img src={item.src} className="w-full h-full object-cover group-hover:scale-102 transition-all duration-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-purple-400 text-xs font-bold tracking-widest uppercase">{item.category}</span>
                  <span className="text-white text-sm font-bold block truncate -mt-0.5">{item.title}</span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {item.bullets.map((b, bIdx) => (
                      <span key={bIdx} className="text-xs text-white/40 font-medium px-2.5 py-1 rounded-full bg-white/5 border border-white/5">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Color Palette Section */}
        <div className="flex flex-col gap-3 mt-1">
          <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest px-1">Color Palette</span>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between backdrop-blur-md">
            {PALETTE.map((pal, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full border border-white/20 shadow-md ${pal.color}`} />
                <span className="text-xs text-white/50 font-medium uppercase tracking-wide">{pal.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Why This Look Section */}
        <div className="flex flex-col gap-3 mt-1">
          <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest px-1">Why This Look?</span>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <ul className="space-y-3.5">
              {REASONS.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-white/80 text-xs md:text-sm font-medium leading-relaxed">
                  <span className="text-purple-400 mt-0.5">✓</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </main>
  );
}
