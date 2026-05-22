"use client";

import { useKioskSocket } from "@/modules/shared/socket/useKioskSocket";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import "../../styles/glow.css";
import WeatherWidget from "@/components/WeatherWidget";

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

export default function WaitingLoginPage() {
  const { isLoggedIn, loggedInUsername } = useKioskSocket();
  const router = useRouter();

  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      );
      setDate(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!BYPASS_AUTH && isLoggedIn) {
      router.push("/logged-in");
    }
  }, [isLoggedIn, loggedInUsername, router]);

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden px-10 py-10">
      {/* Header */}
      <div className="flex items-center shrink-0 py-4 px-4 mb-6">
        <div
          style={{
            flex: "0 0 25%",
            width: "25%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <WeatherWidget iconSize={32} />
        </div>
        <div
          style={{
            flex: "0 0 50%",
            width: "50%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <span className="text-white font-semibold text-3xl tracking-wide select-none">
            StyleOS
          </span>
        </div>
        <div
          style={{
            flex: "0 0 25%",
            width: "25%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <p className="text-white font-semibold text-2xl leading-tight">
            {time}
          </p>
          <p className="text-white/40 text-sm mt-0.5">{date}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center gap-10 w-full"
          >
            {/* Title */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                delay: 0.2,
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="space-y-4"
            >
              <h1
                className="text-white font-bold tracking-tight"
                style={{ fontSize: 72, lineHeight: 1.05 }}
              >
                Waiting to Connect
              </h1>
              <p className="text-white/40 text-xl font-light max-w-lg mx-auto leading-relaxed">
                Your mirror has been scanned. Please complete the onboarding
                process on the other device.
              </p>
            </motion.div>

            {/* Loading dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-3"
            >
              {[0, 0.2, 0.4].map((delay) => (
                <motion.div
                  key={delay}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay }}
                  className="w-3 h-3 rounded-full bg-white"
                />
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
