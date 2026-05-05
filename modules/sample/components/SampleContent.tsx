"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Code, Globe, Layout } from "lucide-react";

export function SampleContent() {
  const specs = [
    { icon: Code, title: "Next.js 15", desc: "App Router & Server Actions" },
    { icon: Layout, title: "Tailwind 4", desc: "Modern styling engine" },
    { icon: Globe, title: "TypeScript", desc: "Type-safe development" },
    { icon: Sparkles, title: "Animations", desc: "Framer Motion & Lucide" },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="p-8 rounded-3xl glass-light border border-white/10 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-core/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <h2 className="text-3xl font-bold mb-4 text-gradient-pink">Sample Component</h2>
        <p className="text-text-secondary leading-relaxed mb-6">
          This is a sample module component showing how to use the boilerplate's
          design tokens and shared components. It's fully responsive and
          supports both dark and light modes.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {specs.map((spec, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
              <spec.icon className="w-5 h-5 text-brand-light mt-1" />
              <div>
                <h4 className="font-semibold text-sm">{spec.title}</h4>
                <p className="text-xs text-text-tertiary">{spec.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
