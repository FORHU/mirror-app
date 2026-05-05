"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Code,
  Globe,
  Layout,
  Cpu,
  ShieldCheck,
  Zap,
  Moon,
  Sun,
  ArrowRight,
} from "lucide-react";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { resolvedTheme, setTheme } = useTheme();
  const isDark = mounted ? resolvedTheme === "dark" : true;
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");
  const router = useRouter();

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background-primary text-text-primary selection:bg-brand-vibrant/30 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.05),transparent_50%)]" />
        <motion.div
          animate={{
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-core/10 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            opacity: [0.2, 0.4, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, delay: 1 }}
          className="absolute top-[20%] -right-[5%] w-[35%] h-[35%] bg-brand-vibrant/10 blur-[120px] rounded-full"
        />
      </div>

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-6 py-6 max-w-7xl mx-auto backdrop-blur-md sticky top-0 transition-all duration-300">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-core to-brand-vibrant flex items-center justify-center glow-primary">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gradient-2026">
              Mirror App 2026
            </span>
          </motion.div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl glass-light hover:bg-white/10 transition-colors border border-white/5"
            >
              {isDark ? <Sun className="w-5 h-4" /> : <Moon className="w-5 h-4" />}
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-24 pb-16 px-6 text-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-light border border-white/5 mb-8 animate-float">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-vibrant opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-vibrant"></span>
              </span>
              <span className="text-xs font-medium text-brand-light">
                v1.0.0 Now Live
              </span>
            </div>

            <h1 className="text-6xl md:text-8xl font-black mb-8 leading-[1.1] tracking-tight">
              Welcome to <br />
              <span className="text-gradient-2026">Smart Mirror.</span>
            </h1>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
              Click "Start now" to get started experiencing the future of smart mirrors.
            </p>

            <div className= "flex flex-col md:flex-row items-center justify-center gap-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/qrcode")}
                className="w-full sm:w-auto px-32 py-5 rounded-2xl bg-white text-brand-dark font-black text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-white/30 transition-all flex items-center justify-center gap-3"
              >
                Start Now
              </motion.button>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
