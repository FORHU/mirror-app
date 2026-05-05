"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/modules/shared/utils";

export function AuthCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "auto" | "light";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "w-full rounded-[2.5rem] p-8 md:p-12 glass shadow-2xl relative overflow-hidden group",
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50 pointer-events-none" />
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
