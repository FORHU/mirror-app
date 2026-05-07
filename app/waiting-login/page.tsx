"use client";

import { useKioskSocket } from "@/modules/shared/socket/useKioskSocket";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
    <main className="min-h-screen bg-background-primary text-text-primary flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl glass p-8 text-center">
        <h1 className="text-3xl font-bold mb-3">Waiting to Login</h1>
        <p className="text-text-secondary mb-4">
          Your kiosk has been scanned. Please complete the login process on the
          other device.
        </p>
      </section>
    </main>
  );
}

