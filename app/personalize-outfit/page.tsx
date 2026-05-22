"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import PersonalizeOutfitCard from "@/components/PersonalizeOutfitCard";
import WeatherWidget from "@/components/WeatherWidget";
import "../../styles/glow.css";

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function PersonalizeOutfit() {
  const router = useRouter();
  const now = useClock();
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString([], { weekday: "long" });
  const date = now.toLocaleDateString([], { month: "long", day: "numeric" });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      <header
        className={"flex items-center shrink-0 py-4 px-4"}
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
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
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            className="text-white font-thin select-none shrink-0"
            style={{ fontSize: "3rem", lineHeight: 1 }}
          >
            {time}
          </span>
          <span className="text-white/80 text-xl font-light select-none shrink-0">
            {day}, {date}
          </span>
        </div>
        <div
          style={{
            flex: "0 0 25%",
            width: "25%",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => router.push("/logged-in")}
            className="p-4 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        </div>
      </header>
      <div
        className="flex items-center justify-center"
        style={{ height: "100%" }}
      >
        <div
          className="flex items-center justify-center"
          style={{ height: "400px", width: "400px" }}
        >
          <PersonalizeOutfitCard />
        </div>
      </div>
    </div>
  );
}
