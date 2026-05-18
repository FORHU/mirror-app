"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Heart, User, Mic, Sun, CloudRain } from "lucide-react";
import { motion } from "motion/react";
import "../../../styles/glow.css";

export default function ChatTemplate() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("BEAUTY MODE");
  const [isListening, setIsListening] = useState(false);

  const tabs = [
    { id: "FASHION MODE", desc: "Less prep, more you" },
    { id: "BEAUTY MODE", desc: "Enhance your natural glow" },
    { id: "OUTING MODE", desc: "Plan smart, go out better" }
  ];

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex flex-col justify-between pt-10 pb-6 px-12">
      {/* Background portrait reflection image of the lady in front of mirror */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-screen scale-100 pointer-events-none"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80')` }}
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

      {/* ── TOP HEADER SECTION ── */}
      <header className="relative z-20 flex justify-between items-start w-full">
        {/* Weather widget */}
        <div className="flex items-center gap-3.5 bg-black/30 border border-white/5 px-5 py-3 rounded-2xl backdrop-blur-md">
          <CloudRain className="w-6 h-6 text-blue-400" />
          <div className="flex flex-col text-left">
            <span className="text-white text-base font-semibold tracking-wide">22°C</span>
            <span className="text-white/40 text-xs font-medium tracking-wide uppercase">Seoul</span>
          </div>
        </div>

        {/* Center Clock */}
        <div className="flex flex-col items-center text-center select-none -mt-2">
          <span className="text-white text-6xl md:text-7xl lg:text-8xl font-extralight tracking-wider">10:30</span>
          <span className="text-white/50 text-sm md:text-base font-light tracking-wide uppercase mt-2">Thursday, April 17</span>
        </div>

        {/* Greetings widget */}
        <div className="flex flex-col text-right bg-black/30 border border-white/5 px-5 py-3 rounded-2xl backdrop-blur-md">
          <span className="text-white text-base font-semibold">Hello!</span>
          <span className="text-white/40 text-xs font-medium tracking-wide uppercase">Have a nice day</span>
        </div>
      </header>

      {/* ── MIDDLE WORKSPACE ── */}
      <div className="relative z-20 flex-1 w-full flex flex-col justify-center items-center mt-6 min-h-0">
        {/* Symmetrical Mode Selector Ribbon */}
        <div className="w-full max-w-4xl grid grid-cols-3 gap-8 mb-16">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center text-center group cursor-pointer"
            >
              <span className={`text-base md:text-lg font-bold tracking-widest uppercase transition-all duration-300 ${
                activeTab === tab.id ? "text-purple-400 scale-105" : "text-white/40 group-hover:text-white/70"
              }`}>
                {tab.id}
              </span>
              <span className={`text-xs md:text-sm tracking-wide mt-1.5 font-light transition-all ${
                activeTab === tab.id ? "text-purple-300/60" : "text-white/20 group-hover:text-white/40"
              }`}>
                {tab.desc}
              </span>
              <div className={`h-0.5 mt-4 rounded-full transition-all duration-500 ${
                activeTab === tab.id 
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 w-28 shadow-[0_0_10px_rgba(168,85,247,0.8)]" 
                  : "bg-transparent w-16"
              }`} />
            </button>
          ))}
        </div>

        {/* AI Chat Dialogue Container (Positioned beautifully on the right side) */}
        <div className="w-full flex justify-end px-12">
          <div className="w-full max-w-lg flex flex-col gap-6">
            {/* User Speech Bubble */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-end gap-2"
            >
              <div className="flex items-center gap-1.5 text-white/30 text-xs font-bold uppercase tracking-widest">
                <span>✦</span>
                <span>You Asked</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tr-none px-6 py-4 backdrop-blur-md shadow-lg max-w-[90%]">
                <p className="text-white text-base font-medium leading-relaxed">
                  Suggest a nice place and activities for a weekend date.
                </p>
              </div>
              <span className="text-[9px] text-white/20 font-bold uppercase mr-1">10:30 AM</span>
            </motion.div>

            {/* AI Stylist Response Bubble */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-end gap-1.5"
            >
              <div className="flex items-center gap-1.5 text-purple-400 text-[10px] font-bold uppercase tracking-widest">
                <span>✦</span>
                <span>AI Answer</span>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl rounded-tr-none px-5 py-4 backdrop-blur-md shadow-[0_4px_30px_rgba(168,85,247,0.05)] max-w-[95%]">
                <p className="text-white/90 text-sm font-medium leading-relaxed">
                  How about a relaxed brunch at a cozy cafe in Seongsu-dong, followed by a walk along Seoul Forest? It&apos;s a lovely spot for a spring day.
                </p>
              </div>
              <span className="text-[9px] text-purple-400/30 font-bold uppercase mr-1">10:30 AM</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── FOOTER VOICE CAPTURE SECTION ── */}
      <footer className="relative z-20 w-full flex flex-col items-center gap-8 mt-6">
        {/* Ask Me Anything Voice Button */}
        <div className="flex flex-col items-center gap-4">
          <motion.button
            animate={isListening ? { scale: [1, 1.1, 1], boxShadow: ["0 0 15px rgba(168,85,247,0.4)", "0 0 35px rgba(168,85,247,0.8)", "0 0 15px rgba(168,85,247,0.4)"] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
            onClick={() => setIsListening(!isListening)}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 relative group cursor-pointer ${
              isListening 
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_4px_25px_rgba(168,85,247,0.6)]" 
                : "bg-white/5 border border-white/10 text-white/80 hover:text-white hover:border-purple-400/40 hover:bg-white/10"
            }`}
          >
            {/* Breathing circles */}
            {isListening && (
              <>
                <div className="absolute inset-0 rounded-full border border-purple-400 animate-ping opacity-60" />
                <div className="absolute -inset-4 rounded-full border border-pink-400/40 animate-pulse" />
              </>
            )}
            <Mic className="w-8 h-8 group-hover:scale-110 transition-transform" />
          </motion.button>
          <span className="text-white/40 text-xs md:text-sm font-semibold tracking-widest uppercase select-none mt-1 animate-pulse">
            {isListening ? "Listening..." : "Ask me anything"}
          </span>
        </div>

        {/* Global Bottom Navigation Dock */}
        <div 
          className="flex items-center justify-center gap-12 px-10 py-4 rounded-full border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] mt-4"
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
      </footer>
    </main>
  );
}
