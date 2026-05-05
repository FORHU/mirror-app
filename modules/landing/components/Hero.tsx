"use client";

import { motion } from "framer-motion";
import { Button } from "@/modules/shared/components/Button";
import { cn } from "@/modules/shared/utils";
import { useApiQuery } from "@/modules/shared/hooks/useApiQuery";
import { LandingStats } from "@/modules/landing/api/landing-api";

export const Hero = () => {
  const { data, isLoading } = useApiQuery<LandingStats>(
    ["landing-stats"],
    "/landing/stats",
  );

  const stats = [
    { label: "Performance", value: "100/100" },
    { label: "Components", value: "50+" },
    { label: "Built for", value: "Next.js 15" },
    { label: "Style", value: "Tailwind 4" },
  ];

  return (
    <section className="relative flex flex-col items-center justify-center pt-48 pb-32 px-6 text-center overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-brand-vibrant/20 blur-[120px] rounded-full -z-10" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] bg-brand-core/10 blur-[100px] rounded-full -z-10" />

      <div className="max-w-4xl space-y-10 relative z-10">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.8 }}
        >
          <h1 className="text-6xl md:text-[120px] font-black tracking-tighter leading-[0.9] mb-8">
            Build the <br />
            <span className="text-gradient-2026">Future.</span>
          </h1>
        </motion.div>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl md:text-2xl text-text-tertiary max-w-2xl mx-auto font-medium leading-relaxed"
        >
          The ultimate Next.js 15 boilerplate for high-performance applications. 
          Engineered for speed, built for the next generation of web development.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6"
        >
          <Button size="lg" className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-gradient-to-r from-brand-core to-brand-vibrant text-white font-black glow-vibrant hover:scale-105 transition-all text-lg">
            Get Started Now
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto h-16 px-10 rounded-2xl border-white/10 glass-light text-white font-black hover:bg-white/5 transition-all text-lg">
            View Components
          </Button>
        </motion.div>

        <div
          className="pt-24 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <span className="text-3xl font-black tracking-tighter">{stat.value}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-text-quaternary mt-2">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
