"use client";

import QRCode from "react-qr-code";
import { useKioskSocket } from "@/modules/shared/socket/useKioskSocket";
import { motion, AnimatePresence } from "motion/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MirrorBQrPage() {
  const { kioskId, kioskName, waitingForLogin, isLoggedIn, loggedInUsername } =
    useKioskSocket("mirror-b");
  const router = useRouter();

  useEffect(() => {
    if (waitingForLogin) router.push("/waiting-login");
  }, [waitingForLogin, router]);

  useEffect(() => {
    if (isLoggedIn)
      router.push(`/kiosk-logged-in?username=${encodeURIComponent(loggedInUsername || "User")}`);
  }, [isLoggedIn, loggedInUsername, router]);

  const qrValue = `${process.env.NEXT_PUBLIC_SITE_URL}/${kioskId}?kioskName=${kioskName}`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#d8b4fe] via-[#f5d0fe] to-[#fecaca] text-text-primary flex items-center justify-center px-6">
      <AnimatePresence mode="wait">
        <motion.div
          key="mirror-b-qr"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex flex-col items-center gap-8 p-12"
        >
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-2"
          >
            <h1 className="text-6xl font-bold bg-gradient-to-r from-[#6b5b95] via-[#8b7fc7] to-[#6b5b95] bg-clip-text text-transparent pb-3">
              Mirror B
            </h1>
            <p className="text-2xl text-[#6b5b95]">Virtual Fitting Experience</p>
          </motion.div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white p-8 rounded-3xl shadow-2xl backdrop-blur-xl"
          >
            <QRCode value={qrValue} size={220} />
          </motion.div>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-xl text-[#6b5b95]/80 text-center max-w-md"
          >
            Scan with your phone to begin your virtual fitting journey
          </motion.p>
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
