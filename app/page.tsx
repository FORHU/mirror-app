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
    <div className="min-h-screen bg-linear-to-br from-[#d8b4fe] via-[#f5d0fe] to-[#fecaca] text-text-primary selection:bg-brand-vibrant/30 overflow-x-hidden">

      <div className="relative z-10">

        {/* Hero Section */}
        <section className="pt-24 pb-16 px-6 text-center max-w-5xl mx-auto flex items-center justify-center h-screen">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >

            <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-[1.1] tracking-tight bg-linear-to-r from-[#6b5b95] via-[#8b7fc7] to-[#6b5b95] bg-clip-text text-transparent">
              Welcome to <br />
              Smart Mirror.
            </h1>
            <p className="text-xl text-[#6b5b95] max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
              Click "Start now" to get started experiencing the future of smart mirrors.
            </p>

            <div className= "flex flex-col md:flex-row items-center justify-center gap-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/qrcode")}
                className="w-full py-4 bg-linear-to-r from-[#8b7fc7] to-[#ffa07a] shadow-lg shadow-purple-300/40 text-[#2d2d3a] font-semibold rounded-xl hover:shadow-purple-400/60 transition-all flex items-center justify-center gap-2"
              >
                Start Now
              </motion.button>

              {process.env.NODE_ENV === 'development' && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    try {
                      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mirror/dev/token`);
                      const { token } = await res.json();
                      if (token) {
                        localStorage.setItem('token', token);
                        router.push("/map");
                      }
                    } catch (err) {
                      alert("Dev bypass failed. Make sure mirror-api is running and seeded.");
                    }
                  }}
                  className="w-full py-4 border border-white/20 text-white/60 font-semibold rounded-xl hover:bg-white/5 transition-all"
                >
                  Dev: Skip to Map
                </motion.button>
              )}
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
