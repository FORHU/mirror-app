"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, History, Home, User, Sparkles, Watch, Shirt, Footprints } from "lucide-react";
import { motion } from "motion/react";
import "../../../styles/glow.css";

const ACCESSORIES = [
  { id: "a1", emoji: "🧢", name: "Green Cap", src: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=200&auto=format&fit=crop" },
  { id: "a2", emoji: "🧢", name: "Red Cap", src: "https://images.unsplash.com/photo-1595642527925-4d41cb781653?w=200&auto=format&fit=crop" },
  { id: "a3", emoji: "🧢", name: "Navy Cap", src: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&auto=format&fit=crop" },
  { id: "a4", emoji: "🕶️", name: "Sunnies", src: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=200&auto=format&fit=crop" },
  { id: "a5", emoji: "🕶️", name: "Glasses", src: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=200&auto=format&fit=crop" },
  { id: "a6", emoji: "🕶️", name: "Aviators", src: "https://images.unsplash.com/photo-1577803645773-f96470509666?w=200&auto=format&fit=crop" },
  { id: "a7", emoji: "💂", name: "Black Beanie", src: "https://images.unsplash.com/photo-1576871337622-98d48d4aa53e?w=200&auto=format&fit=crop" },
  { id: "a8", emoji: "💂", name: "Grey Beanie", src: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=200&auto=format&fit=crop" },
  { id: "a9", emoji: "💂", name: "Cream Beanie", src: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=200&auto=format&fit=crop" }
];

const OUTFITS = [
  { id: "o1", label: "LOOK 1", tag: "Casual Classic", desc: "Trench coat & jeans", src: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=250&auto=format&fit=crop" },
  { id: "o2", label: "LOOK 2", tag: "Denim Chill", desc: "Shacket & white trousers", src: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=250&auto=format&fit=crop" },
  { id: "o3", label: "LOOK 3", tag: "Preppy Warmth", desc: "Sweater & pants", src: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=250&auto=format&fit=crop" },
  { id: "o4", label: "LOOK 4", tag: "Minimal Office", desc: "Blazer & pleated skirt", src: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=250&auto=format&fit=crop" }
];

const TOPS = [
  { id: "t1", src: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=150&auto=format&fit=crop" },
  { id: "t2", src: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=150&auto=format&fit=crop" },
  { id: "t3", src: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=150&auto=format&fit=crop" },
  { id: "t4", src: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=150&auto=format&fit=crop" },
  { id: "t5", src: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=150&auto=format&fit=crop" },
  { id: "t6", src: "https://images.unsplash.com/photo-1603252109303-2751441dd157?w=150&auto=format&fit=crop" }
];

const OUTER = [
  { id: "ou1", src: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=150&auto=format&fit=crop" },
  { id: "ou2", src: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=150&auto=format&fit=crop" },
  { id: "ou3", src: "https://images.unsplash.com/photo-1544923246-77307dd654cb?w=150&auto=format&fit=crop" },
  { id: "ou4", src: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop" },
  { id: "ou5", src: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=150&auto=format&fit=crop" },
  { id: "ou6", src: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=150&auto=format&fit=crop" }
];

const BOTTOMS = [
  { id: "b1", src: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=150&auto=format&fit=crop" },
  { id: "b2", src: "https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=150&auto=format&fit=crop" },
  { id: "b3", src: "https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=150&auto=format&fit=crop" },
  { id: "b4", src: "https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=150&auto=format&fit=crop" },
  { id: "b5", src: "https://images.unsplash.com/photo-1475178626620-a4d074967452?w=150&auto=format&fit=crop" },
  { id: "b6", src: "https://images.unsplash.com/photo-1551854838-212c50b4c184?w=150&auto=format&fit=crop" }
];

const SHOES = [
  { id: "s1", src: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=150&auto=format&fit=crop" },
  { id: "s2", src: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=150&auto=format&fit=crop" },
  { id: "s3", src: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=150&auto=format&fit=crop" },
  { id: "s4", src: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=150&auto=format&fit=crop" },
  { id: "s5", src: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=150&auto=format&fit=crop" },
  { id: "s6", src: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop" }
];

export default function FashionTemplate() {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState("Casual");
  const [favorites, setFavorites] = useState<string[]>([]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex flex-row">
      {/* Background reflection image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-screen scale-105 pointer-events-none"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&auto=format&fit=crop&q=80')` }}
      />
      
      {/* Absolute Header Overlay */}
      <div className="absolute top-6 left-6 z-40">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push("/mirror-templates")}
          className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all backdrop-blur"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
      </div>

      {/* ── LEFT PANEL (Accessories & Outfits) ── */}
      <aside className="w-1/4 h-full flex flex-col p-4 md:p-6 gap-5 md:gap-7 z-20 bg-black/60 backdrop-blur-md border-r border-white/5 overflow-y-auto">
        {/* Accessories Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest">Accessories</span>
            <Watch className="w-4 h-4 text-purple-400" />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {ACCESSORIES.map(acc => (
              <div 
                key={acc.id} 
                className="aspect-square rounded-2xl bg-white/5 border border-white/10 hover:border-purple-400/40 cursor-pointer overflow-hidden flex items-center justify-center relative group transition-all"
              >
                <img src={acc.src} alt={acc.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-all pointer-events-none" />
                <span className="absolute bottom-1.5 right-2 text-base">{acc.emoji}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Outfit Looks Section */}
        <div className="flex flex-col gap-3 flex-1 mt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest">Outfit Looks</span>
            <span className="text-xs md:text-sm text-purple-400 font-bold">4 Looks</span>
          </div>
          <div className="flex flex-col gap-3.5">
            {OUTFITS.map(outfit => (
              <div 
                key={outfit.id} 
                className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-400/30 transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
                  <img src={outfit.src} alt={outfit.label} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-white text-xs md:text-sm font-bold uppercase tracking-wide block">{outfit.label}</span>
                  <span className="text-white/60 text-xs font-medium block truncate mt-0.5">{outfit.tag}</span>
                  <span className="text-white/30 text-xs block mt-0.5">{outfit.desc}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(outfit.id); }}
                  className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-purple-500/20 hover:border-purple-400/30 transition-all"
                >
                  <Heart className={`w-4 h-4 ${favorites.includes(outfit.id) ? "fill-purple-400 text-purple-400" : "text-white/40"}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── CENTER PANEL (Human outline & mirror controls) ── */}
      <section className="flex-1 h-full flex flex-col items-center justify-between pt-10 pb-6 px-6 z-10 relative">
        {/* Clock & Date Header */}
        <div className="flex flex-col items-center text-center mt-2 select-none">
          <span className="text-white text-6xl md:text-7xl lg:text-8xl font-extralight tracking-widest">10:30</span>
          <span className="text-white/50 text-sm md:text-base font-light tracking-wide uppercase mt-2">Thursday, April 17</span>
          <span className="text-purple-300/80 text-xs md:text-sm font-bold tracking-widest uppercase mt-5 block">Fashion Mode</span>
        </div>

        {/* Mode Selector Tab Pills */}
        <div className="flex gap-2.5 bg-black/40 border border-white/5 p-1.5 rounded-2xl backdrop-blur-md mt-4">
          {["Casual", "Office", "Date"].map(mode => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`px-8 py-3 rounded-xl text-xs md:text-sm font-bold tracking-wide transition-all uppercase ${
                activeMode === mode 
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_2px_10px_rgba(168,85,247,0.3)]" 
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Dynamic Action Buttons */}
        <div className="flex gap-6 mt-6">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-black/30 text-white/60 hover:text-white hover:bg-black/50 transition-all text-xs md:text-sm">
            <Heart className="w-4 h-4" />
            <span>Favorite</span>
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-black/30 text-white/60 hover:text-white hover:bg-black/50 transition-all text-xs md:text-sm">
            <History className="w-4 h-4" />
            <span>History</span>
          </button>
        </div>

        {/* Reflection Guide overlay (Sleek minimalist target frame) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="border border-dashed border-white/30 rounded-[100px] w-[320px] md:w-[400px] h-[600px] md:h-[780px] relative">
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white/40" />
          </div>
        </div>

        {/* Floating Mirror Navigation Bar */}
        <footer 
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
        </footer>
      </section>

      {/* ── RIGHT PANEL (Tops, Outerwear, Bottoms, Shoes Grids) ── */}
      <aside className="w-1/4 h-full flex flex-col p-4 md:p-6 gap-5 md:gap-7 z-20 bg-black/60 backdrop-blur-md border-l border-white/5 overflow-y-auto scrollbar-hide">
        {/* Tops Grid */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <Shirt className="w-4 h-4 text-purple-400" />
            <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest">Tops</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TOPS.map(item => (
              <div key={item.id} className="aspect-square rounded-2xl bg-white/5 border border-white/10 hover:border-purple-400/40 cursor-pointer overflow-hidden transition-all">
                <img src={item.src} className="w-full h-full object-cover opacity-50 hover:opacity-85 transition-all" />
              </div>
            ))}
          </div>
        </div>

        {/* Outer Grid */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-base">🧥</span>
            <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest">Outerwear</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {OUTER.map(item => (
              <div key={item.id} className="aspect-square rounded-2xl bg-white/5 border border-white/10 hover:border-purple-400/40 cursor-pointer overflow-hidden transition-all">
                <img src={item.src} className="w-full h-full object-cover opacity-50 hover:opacity-85 transition-all" />
              </div>
            ))}
          </div>
        </div>

        {/* Bottoms Grid */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-base">👖</span>
            <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest">Bottoms</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {BOTTOMS.map(item => (
              <div key={item.id} className="aspect-square rounded-2xl bg-white/5 border border-white/10 hover:border-purple-400/40 cursor-pointer overflow-hidden transition-all">
                <img src={item.src} className="w-full h-full object-cover opacity-50 hover:opacity-85 transition-all" />
              </div>
            ))}
          </div>
        </div>

        {/* Shoes Grid */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2 px-1">
            <Footprints className="w-4 h-4 text-purple-400" />
            <span className="text-xs md:text-sm text-white/40 font-bold uppercase tracking-widest">Shoes</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SHOES.map(item => (
              <div key={item.id} className="aspect-square rounded-2xl bg-white/5 border border-white/10 hover:border-purple-400/40 cursor-pointer overflow-hidden transition-all">
                <img src={item.src} className="w-full h-full object-cover opacity-50 hover:opacity-85 transition-all" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
