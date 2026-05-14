"use client";

import { useKioskSocket } from "@/modules/shared/socket/useKioskSocket";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from 'motion/react';

export default function WaitingLoginPage() {
  const {
    isLoggedIn,
    loggedInUsername,
  } = useKioskSocket();
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn) {
      router.push(
        `/kiosk-logged-in?username=${encodeURIComponent(loggedInUsername || "User")}`,
      );
    }
  }, [isLoggedIn, loggedInUsername, router]);

  return (
    <main className="min-h-dvh bg-linear-to-br from-[#d8b4fe] via-[#f5d0fe] to-[#fecaca] text-text-primary flex items-center justify-center px-6">
      <AnimatePresence mode="wait">
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center gap-8 p-12"
          >
            {/* Title */}
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center space-y-4"
            >
              <h1 className="text-6xl font-bold bg-linear-to-r from-[#6b5b95] via-[#8b7fc7] to-[#6b5b95] bg-clip-text text-transparent pb-5">
                Waiting to Connect
              </h1>
              <p className="text-2xl text-[#6b5b95]">Your mirror has been scanned. Please complete the onboarding process on the other device.</p>
            </motion.div>

            {/* Loading dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-2 mt-2"
            >
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                className="w-3 h-3 bg-linear-to-r from-[#8b7fc7] to-[#ffa07a] rounded-full"
              />
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                className="w-3 h-3 bg-linear-to-r from-[#8b7fc7] to-[#ffa07a] rounded-full"
              />
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                className="w-3 h-3 bg-linear-to-r from-[#8b7fc7] to-[#ffa07a] rounded-full"
              />
            </motion.div>
          </motion.div>
      </AnimatePresence>
    </main>
  );
}

