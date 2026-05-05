"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Globe, ArrowLeft } from "lucide-react";
import { cn } from "@/modules/shared/utils";

interface AuthLayoutProps {
  children: React.ReactNode;
  headline?: string[];
  tagline?: string;
  className?: string;
}

export function AuthLayout({
  children,
  headline = ["Build faster.", "Ship better."],
  tagline = "Experience the ultimate Next.js 15 boilerplate with a premium 2026 aesthetic.",
  className,
}: AuthLayoutProps) {
  return (
    <div
      className={cn(
        "min-h-screen w-full relative overflow-hidden bg-background-primary",
        className,
      )}
    >
      {/* 2026 Background Gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-brand-core/20 blur-[150px] rounded-full"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.05, 0.15, 0.05],
          }}
          transition={{ duration: 18, repeat: Infinity, delay: 2 }}
          className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-brand-vibrant/20 blur-[150px] rounded-full"
        />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row min-h-screen">
        {/* Left Side: Branding & Info */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="hidden lg:flex flex-col justify-between w-[45%] p-16 xl:p-24 bg-black/5 backdrop-blur-3xl border-r border-white/5"
        >
          <div>
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-core to-brand-vibrant flex items-center justify-center glow-primary group-hover:scale-110 transition-transform duration-500">
                {/* Add Logo here */}
              </div>
              <span className="text-xl font-bold tracking-tighter text-gradient-2026">
                BOILERPLATE
              </span>
            </Link>

            <div className="mt-24">
              <h1 className="text-6xl xl:text-7xl font-black leading-[1.1] mb-8 tracking-tight">
                {headline.map((line, i) => (
                  <span
                    key={i}
                    className={
                      i === 1 ? "text-gradient-2026" : "text-text-primary"
                    }
                  >
                    {line}
                    <br />
                  </span>
                ))}
              </h1>
              <p className="text-lg text-text-secondary max-w-sm leading-relaxed font-medium">
                {tagline}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-8 text-sm font-bold text-text-quaternary">
            <button className="flex items-center gap-2 hover:text-brand-light transition-colors">
              <Globe className="w-4 h-4" />
              English (US)
            </button>
            <Link
              href="/help"
              className="hover:text-brand-light transition-colors"
            >
              Support
            </Link>
            <Link
              href="/terms"
              className="hover:text-brand-light transition-colors"
            >
              Privacy
            </Link>
          </div>
        </motion.div>

        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-6 w-full border-b border-white/5 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-core to-brand-vibrant flex items-center justify-center shadow-lg shadow-brand-core/20">
              <Image
                src="/logo.png"
                alt="Logo"
                width={20}
                height={20}
                className="object-contain"
              />
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs font-bold text-text-tertiary flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </Link>
        </div>

        {/* Right Side: Auth Forms */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-[480px]"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
