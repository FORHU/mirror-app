"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Shirt,
  MessageSquare,
  Compass,
  Briefcase,
} from "lucide-react";
import { ROUTES } from "@/navigation";
import { motion } from "motion/react";
import "../../styles/glow.css";

const templates = [
  {
    id: "fashion",
    title: "1. Interactive Fashion Mode",
    description:
      "Symmetrical garment selection grid with Accessories, Outfit Looks, Tops, Outer, Bottoms, and Shoes panels.",
    path: "/mirror-templates/fashion",
    icon: Shirt,
    color: "from-purple-500/20 to-pink-500/20",
    borderColor: "border-purple-500/30",
    glowColor: "shadow-[0_0_30px_rgba(168,85,247,0.15)]",
    emoji: "👗",
  },
  {
    id: "chat",
    title: "2. Voice Chat Assistant",
    description:
      "AI fashion stylist conversational interface with interactive chat history bubbles and a breathing glow microphone widget.",
    path: "/mirror-templates/chat",
    icon: MessageSquare,
    color: "from-blue-500/20 to-indigo-500/20",
    borderColor: "border-blue-500/30",
    glowColor: "shadow-[0_0_30px_rgba(59,130,246,0.15)]",
    emoji: "💬",
  },
  {
    id: "outing",
    title: "3. Outing Mode & Map",
    description:
      "Multi-panel dashboard featuring side-by-side look comparisons, dynamic calendar timeline, and dark GPS route navigation.",
    path: "/mirror-templates/outing",
    icon: Compass,
    color: "from-emerald-500/20 to-teal-500/20",
    borderColor: "border-emerald-500/30",
    glowColor: "shadow-[0_0_30px_rgba(16,185,129,0.15)]",
    emoji: "🗺️",
  },
  {
    id: "office",
    title: "4. Professional Office Mode",
    description:
      "Sleek office-wear styling template displaying vertical previous pick reels, color palettes, and structured outfit metadata.",
    path: "/mirror-templates/office",
    icon: Briefcase,
    color: "from-amber-500/20 to-orange-500/20",
    borderColor: "border-amber-500/30",
    glowColor: "shadow-[0_0_30px_rgba(245,158,11,0.15)]",
    emoji: "💼",
  },
];

export default function TemplatesHome() {
  const router = useRouter();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 pt-10 pb-6 flex-none border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push(ROUTES.LOGGED_IN)}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h1 className="text-white font-extrabold text-2xl tracking-wide flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Smart Mirror Screen Templates
            </h1>
            <p className="text-white/40 text-xs mt-0.5">
              Explore premium layout references inspired by your designs
            </p>
          </div>
        </div>
      </header>

      {/* Grid Container */}
      <div className="relative z-10 flex-1 overflow-y-auto px-10 py-10 flex items-center justify-center min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
          {templates.map((tmpl) => {
            const Icon = tmpl.icon;
            return (
              <motion.button
                key={tmpl.id}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(tmpl.path)}
                className={`text-left p-6 rounded-3xl bg-gradient-to-br ${tmpl.color} border ${tmpl.borderColor} ${tmpl.glowColor} backdrop-blur-xl relative overflow-hidden transition-all group flex flex-col justify-between h-56`}
              >
                {/* Background lighting */}
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-500" />

                <div className="flex items-start justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-white/20 transition-all">
                    <Icon className="w-7 h-7 text-white/80 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                  </div>
                  <span className="text-4xl select-none">{tmpl.emoji}</span>
                </div>

                <div className="mt-4">
                  <h3 className="text-white font-extrabold text-lg tracking-wide group-hover:text-purple-300 transition-colors">
                    {tmpl.title}
                  </h3>
                  <p className="text-white/50 text-sm mt-1.5 leading-relaxed font-light">
                    {tmpl.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
