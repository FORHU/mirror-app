"use client";

import QRCode from "react-qr-code";
import { useKioskSocket } from "@/modules/shared/socket/useKioskSocket";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function QrCodePage() {
  const {
    kioskId,
    isConnected,
    isRegistered,
    waitingForLogin,
    isLoggedIn,
    loggedInUsername,
  } = useKioskSocket();
  const router = useRouter();

  useEffect(() => {
    if (waitingForLogin) {
      router.push("/waiting-login");
    }
  }, [waitingForLogin, router]);

  useEffect(() => {
    if (isLoggedIn) {
      router.push(
        `/kiosk-logged-in?username=${encodeURIComponent(loggedInUsername || "User")}`,
      );
    }
  }, [isLoggedIn, loggedInUsername, router]);

  return (
    <main className="min-h-screen bg-background-primary text-text-primary flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl glass p-8 text-center">
        <h1 className="text-3xl font-bold mb-3">Your QR Code</h1>
        <p className="text-text-secondary mb-6">
          Scan this QR code to continue logging in to your device:
        </p>
        <div className="bg-white p-4 rounded-xl inline-block">
          <QRCode value={"http://192.168.1.24:3000/" + kioskId} size={220} />
        </div>
        <p className="mt-4 text-sm text-text-secondary break-all">{kioskId}</p>
        <p className="mt-2 text-sm">
          Socket: {isConnected ? "Connected" : "Connecting..."} | Kiosk:{" "}
          {isRegistered ? "Registered" : "Registering..."}
        </p>
      </section>
    </main>
  );
}
