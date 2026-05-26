"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "../../styles/glow.css";
import { ROUTES } from "@/navigation";
import WeatherWidget from "@/components/WeatherWidget";
import { setCachedAccessToken } from "@/modules/shared/api/api-client";
import { authService } from "@/modules/shared/api/auth.service";
import { setStorageData } from "@/modules/shared/utils/storage";
import { setAuthCookie } from "@/modules/shared/utils/auth-cookie";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { ACCESS_TOKEN, USER } from "@/modules/shared/constants/storage-keys";
import type { User } from "@/modules/shared/api/api.types";

function getKioskToken(): string {
  const isKiosk2 = window.location.hostname === process.env.NEXT_PUBLIC_DOMAIN2;
  return isKiosk2
    ? (process.env.NEXT_PUBLIC_USER2_ACCESS_TOKEN ?? "")
    : (process.env.NEXT_PUBLIC_USER1_ACCESS_TOKEN ?? "");
}

function SelectGenderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleContinue(gender: "MALE" | "FEMALE") {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const token = getKioskToken();
      setCachedAccessToken(token);
      const user: User = await authService.updateProfile({ gender });

      await setStorageData(ACCESS_TOKEN, token);
      await setStorageData(USER, user);
      useAuthStore.setState({ isAuthenticated: true, user });
      setAuthCookie();
      sessionStorage.setItem("mirror_gender", gender);

      const next = searchParams.get("next");
      if (next === "cosmetic") {
        router.push(ROUTES.LOGGED_IN);
      } else {
        router.push(ROUTES.LOGGED_IN);
      }
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message ??
          "Something went wrong. Please try again.",
      );
      setIsLoading(false);
    }
  }

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

      {/* Main Heading */}
      <div className="text-center mb-10 shrink-0">
        <h1 className="text-white font-bold text-5xl tracking-tight mb-3">
          What&apos;s your gender?
        </h1>
        <p className="text-white/40 text-xl">
          We use this to personalise your experience
        </p>
      </div>

      {/* Gender Cards */}
      <div className="flex flex-row gap-6 flex-1 min-h-0">
        {/* Male */}
        <button
          onClick={() => handleContinue("MALE")}
          disabled={isLoading}
          className="flex-1 glass-card-strong border border-white/10 rounded-3xl flex flex-col items-center justify-center gap-6 transition-all active:scale-95 disabled:opacity-50"
        >
          <div className="text-white" style={{ fontSize: 80, lineHeight: 1 }}>
            ♂
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-3xl mb-2">Male</h3>
            <p className="text-white/45 text-lg">
              Men&apos;s style &amp; grooming
            </p>
          </div>
        </button>

        {/* Female */}
        <button
          onClick={() => handleContinue("FEMALE")}
          disabled={isLoading}
          className="flex-1 glass-card-strong border border-white/10 rounded-3xl flex flex-col items-center justify-center gap-6 transition-all active:scale-95 disabled:opacity-50"
        >
          <div className="text-white" style={{ fontSize: 80, lineHeight: 1 }}>
            ♀
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-3xl mb-2">Female</h3>
            <p className="text-white/45 text-lg">
              Women&apos;s style &amp; beauty
            </p>
          </div>
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-center text-base mt-4 shrink-0">
          {error}
        </p>
      )}
    </div>
  );
}

export default function SelectGenderPage() {
  return (
    <Suspense>
      <SelectGenderContent />
    </Suspense>
  );
}
