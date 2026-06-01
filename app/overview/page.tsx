"use client";

import { ShirtIcon, Sparkles, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import "../../styles/glow.css";
import { ROUTES } from "@/navigation";
import WeatherWidget from "@/components/WeatherWidget";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ChatWonderChat } from "@/modules/shared/ai/ChatWonderChat";
import { useWeather } from "@/modules/shared/hooks/useWeather";

export default function OverviewPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const gender =
    typeof window !== "undefined"
      ? sessionStorage.getItem("mirror_gender")
      : null;
  const { weather } = useWeather();

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
          <div className="flex items-center">
            <span className="text-white font-semibold text-3xl tracking-wide select-none">
              StyleOS
            </span>
            <LanguageSelector />
          </div>
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

      {/* User summary */}
      <div className="text-center mb-10 shrink-0">
        <h1 className="text-white font-bold text-5xl tracking-tight mb-3">
          {user?.displayName ?? "Your Session"}
        </h1>
        <div className="flex items-center justify-center gap-4 text-white/40 text-lg">
          {user?.username && <span>@{user.username}</span>}
          {gender && (
            <>
              <span>·</span>
              <span className="capitalize">{gender.toLowerCase()}</span>
            </>
          )}
        </div>
      </div>

      {/* Feature shortcuts */}
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <p className="text-white/30 text-sm uppercase tracking-widest text-center mb-2">
          Jump to a feature
        </p>

        <div className="flex flex-row gap-4 flex-1 min-h-0">
          <button
            onClick={() => router.push(ROUTES.AI_RECOMMENDATION_FASHION)}
            className="flex-1 glass-card-strong neon-border-white rounded-3xl flex flex-col items-center justify-center gap-4 transition-all active:scale-95"
          >
            <div className="icon-spotlight">
              <div className="icon-box">
                <ShirtIcon className="w-10 h-10 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-xl mb-1">Fashion</h3>
              <p className="text-white/40 text-sm">Try on clothes</p>
            </div>
          </button>

          <button
            onClick={() => {
              window.location.href = ROUTES.AI_RECOMMENDATION_COSMETIC;
            }}
            className="flex-1 glass-card-strong neon-border-white glow-white rounded-3xl flex flex-col items-center justify-center gap-4 transition-all active:scale-95"
          >
            <div className="icon-spotlight">
              <div className="icon-box">
                <Sparkles className="w-10 h-10 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-xl mb-1">Cosmetics</h3>
              <p className="text-white/40 text-sm">Skin analysis</p>
            </div>
          </button>

          <button
            onClick={() => router.push(ROUTES.MAP)}
            className="flex-1 glass-card-strong neon-border-white rounded-3xl flex flex-col items-center justify-center gap-4 transition-all active:scale-95"
          >
            <div className="icon-spotlight">
              <div className="icon-box">
                <MapPin className="w-10 h-10 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-white font-bold text-xl mb-1">Map</h3>
              <p className="text-white/40 text-sm">Explore the store</p>
            </div>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-6 shrink-0">
        <button
          onClick={() => router.push(ROUTES.LOGGED_IN)}
          className="text-white/40 hover:text-white text-lg transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => router.push(ROUTES.WELCOME)}
          className="logout-btn px-8 py-3 text-white text-lg font-medium"
        >
          Restart
        </button>
      </div>

      {/* ChatWonder Chat overlay */}
      <ChatWonderChat mode="overview" weather={weather} />
    </div>
  );
}
