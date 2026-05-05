"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/modules/shared/utils";

interface AppLoaderProps {
  isLoading?: boolean;
  isError?: boolean;
  fullScreen?: boolean;
  className?: string;
  statusText?: string;
}

export const AppLoader: React.FC<AppLoaderProps> = ({
  isLoading = true,
  isError = false,
  fullScreen = false,
  className,
  statusText = "Initializing",
}) => {
  if (!isLoading && !isError) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-8 p-4 w-full h-full min-h-[200px]",
        fullScreen &&
          "fixed inset-0 z-[100] bg-background-primary/80 backdrop-blur-xl",
        className,
      )}
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center">
          {/* Logo Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-24 h-24 mb-10"
          >
            <div className="absolute inset-0 bg-brand-core/30 blur-3xl rounded-full animate-pulse-glow" />
            <motion.div
              animate={{
                rotateY: [0, 180, 360],
                rotateZ: [0, 5, -5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative z-10 w-full h-full"
            >
              {/* Add image logo here */}
              {/* <Image
                src="/logo.png"
                alt="Logo"
                width={96}
                height={96}
                className="object-contain"
                priority
              /> */}
            </motion.div>
          </motion.div>

          {/* Status Container */}
          <div className="flex flex-col items-center gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <span className="text-2xl font-black tracking-[0.3em] uppercase text-gradient-2026 ml-[0.3em] animate-pulse">
                {statusText}
              </span>
              <div className="absolute -bottom-2 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-vibrant to-transparent opacity-50" />
            </motion.div>

            <div className="flex items-center gap-2 mt-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                  className="w-1.5 h-1.5 rounded-full bg-brand-vibrant shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-4 opacity-50">
          <div className="w-12 h-12 rounded-full border-2 border-red-500/20 border-t-red-500 animate-spin mx-auto mb-4" />
          <p className="text-text-primary text-lg font-bold tracking-widest uppercase">
            Initialization Failed
          </p>
        </div>
      )}
    </div>
  );
};
