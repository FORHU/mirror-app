"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/navigation";
import "../../styles/glow.css";
import {
  outfitService,
  type RemoteOutfit,
} from "@/modules/shared/api/outfit.service";
import WeatherWidget from "@/components/WeatherWidget";

function useSwipe(onLeft: () => void, onRight: () => void) {
  const startX = useRef<number | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      startX.current = e.touches[0].clientX;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (startX.current === null) return;
      const delta = e.changedTouches[0].clientX - startX.current;
      startX.current = null;
      if (delta < -40) onLeft();
      else if (delta > 40) onRight();
    },
    onMouseDown: (e: React.MouseEvent) => {
      startX.current = e.clientX;
    },
    onMouseUp: (e: React.MouseEvent) => {
      if (startX.current === null) return;
      const delta = e.clientX - startX.current;
      startX.current = null;
      if (delta < -40) onLeft();
      else if (delta > 40) onRight();
    },
    onMouseLeave: () => {
      startX.current = null;
    },
  };
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex-1 h-px bg-white/20" />
      <span className="text-white text-xs font-bold tracking-widest uppercase">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/20" />
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function VirtualMirrorV2() {
  const router = useRouter();
  const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
  const [selectedOutfitIdx, setSelectedOutfitIdx] = useState<number | null>(
    null,
  );
  const selectedOutfit =
    selectedOutfitIdx !== null ? (outfits[selectedOutfitIdx] ?? null) : null;
  const outfitPageSize = 10;
  const [outfitPage, setOutfitPage] = useState(0);
  const totalOutfitPages = Math.max(
    1,
    Math.ceil(outfits.length / outfitPageSize),
  );
  const pagedOutfits = outfits.slice(
    outfitPage * outfitPageSize,
    (outfitPage + 1) * outfitPageSize,
  );
  const outfitSwipe = useSwipe(
    () => setOutfitPage((p) => Math.min(p + 1, totalOutfitPages - 1)),
    () => setOutfitPage((p) => Math.max(p - 1, 0)),
  );
  const now = useClock();

  useEffect(() => {
    outfitService
      .getAll()
      .then(setOutfits)
      .catch((err) => console.error("[Outfits] fetch error:", err));
  }, []);

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString([], { weekday: "long" });
  const date = now.toLocaleDateString([], { month: "long", day: "numeric" });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      <header
        className={"flex items-center justify-between shrink-0 py-4 px-4"}
      >
        <WeatherWidget iconSize={32} />
        <span className="text-white font-semibold text-3xl tracking-wide select-none">
          {" "}
          AI Recommendation
        </span>
        <button
          onClick={() => router.push(ROUTES.LOGGED_IN)}
          className="p-4 transition-all hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
      </header>
      <div className="flex flex-1 relative" style={{ height: "546px" }}>
        {/* Left panel — AI chat + Outfit grid */}
        <div className="flex-1 h-full flex flex-col p-2 gap-2 min-h-0">
          <div
            className="flex flex-col gap-1"
            style={{ flex: 1, minHeight: 0 }}
          >
            <SectionTitle label="Outfit" />
            <div
              {...outfitSwipe}
              style={{
                touchAction: "pan-y",
                userSelect: "none",
                cursor: "grab",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  rowGap: "10px",
                  columnGap: "6px",
                }}
              >
                {pagedOutfits.map((outfit, i) => {
                  const globalIdx = outfitPage * outfitPageSize + i;
                  return (
                    <div
                      key={outfit.id}
                      onClick={() => setSelectedOutfitIdx(globalIdx)}
                      style={{
                        position: "relative",
                        aspectRatio: "3/5",
                        borderRadius: "10px",
                        overflow: "hidden",
                        background: "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                        border:
                          selectedOutfitIdx === globalIdx
                            ? "2px solid rgba(255,255,255,0.6)"
                            : "2px solid transparent",
                        transition: "border-color 0.2s",
                      }}
                    >
                      {outfit.file?.fileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={outfit.file.fileUrl}
                          alt={outfit.name}
                          draggable={false}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      ) : (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span
                            style={{
                              color: "rgba(255,255,255,0.2)",
                              fontSize: "11px",
                            }}
                          >
                            {outfit.name}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          background: "rgba(0,0,0,0.35)",
                          border: "none",
                          borderRadius: "50%",
                          width: "24px",
                          height: "24px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-1.5 pt-2">
                {Array.from({ length: totalOutfitPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setOutfitPage(i)}
                    style={{
                      width: i === outfitPage ? 12 : 4,
                      height: 4,
                      borderRadius: "9999px",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      background:
                        i === outfitPage ? "white" : "rgba(255,255,255,0.3)",
                      transition: "all 0.3s",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center panel — wider now */}
        <div className="flex-[2] h-full flex flex-col items-center justify-start pt-8 gap-1">
          <span
            className="text-white font-thin select-none"
            style={{ fontSize: "3rem", lineHeight: 1 }}
          >
            {time}
          </span>
          <span className="text-white/80 text-xl font-light select-none mb-4">
            {day}, {date}
          </span>
        </div>

        {/* Outfit Details sidebar — slides in from right */}
        <div
          style={{
            position: "absolute",
            bottom: 90,
            right: 0,
            height: "75%",
            width: "220px",
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(16px)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            padding: "8px",
            transform:
              selectedOutfitIdx === null ? "translateX(100%)" : "translateX(0)",
            transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
            zIndex: 20,
            overflow: "hidden",
          }}
        >
          {/* Header — fixed */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <SectionTitle label="Outfit Details" />
            <button
              onClick={() => setSelectedOutfitIdx(null)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
                padding: "0 4px",
              }}
            >
              ✕
            </button>
          </div>
          {/* Garment cards — proportional flex, each shares available space equally */}
          <div
            style={{
              flex: "3 1 0",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              overflow: "hidden",
            }}
          >
            {(selectedOutfit?.items ?? [])
              .slice()
              .sort((a, b) => {
                const UPPER = [
                  "Shirt",
                  "TShirt",
                  "Polo",
                  "Blouse",
                  "Hoodie",
                  "Sweater",
                  "Jacket",
                  "Coat",
                  "Blazer",
                ];
                const LOWER = ["Pants", "Jeans", "Shorts", "Skirt"];
                const FOOT = [
                  "Shoes",
                  "Sneakers",
                  "Sandals",
                  "Boots",
                  "Heels",
                  "Socks",
                ];
                const HEAD = ["Hat", "Beanie", "Cap", "Headband"];
                const rank = (types: string[]) => {
                  const t = types[0] ?? "";
                  if (UPPER.includes(t)) return 0;
                  if (LOWER.includes(t)) return 1;
                  if (FOOT.includes(t)) return 2;
                  if (HEAD.includes(t)) return 3;
                  return 4;
                };
                return (
                  rank(a.garment.garmentType) - rank(b.garment.garmentType)
                );
              })
              .map((item) => (
                <div
                  key={item.id}
                  className="flex glass-card-garment"
                  style={{
                    flex: "1 1 0",
                    minHeight: 0,
                    width: "100%",
                    alignItems: "stretch",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      flex: "0 0 40%",
                      background: "rgba(255,255,255,0.01)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "8px 0 0 8px",
                      overflow: "hidden",
                    }}
                  >
                    {item.garment.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.garment.imageUrl}
                        alt={item.garment.name}
                        draggable={false}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <span
                        style={{
                          color: "rgba(255,255,255,0.25)",
                          fontSize: "10px",
                        }}
                      >
                        Img
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "5px 8px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: "2px",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.garment.garmentType[0]}
                    </span>
                    <span
                      style={{
                        color: "white",
                        fontSize: "10px",
                        fontWeight: 600,
                        lineHeight: 1.3,
                        overflow: "hidden",
                      }}
                    >
                      {item.garment.name}
                    </span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.45)",
                        fontSize: "9px",
                        lineHeight: 1.4,
                        overflow: "hidden",
                      }}
                    >
                      {item.garment.description}
                    </span>
                  </div>
                </div>
              ))}
          </div>
          {/* Why this look? — fixed at bottom */}
          <div
            className="glass-card-garment"
            style={{
              flex: "1 1 0",
              minHeight: 0,
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: "9px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                flexShrink: 0,
              }}
            >
              Why This Look?
            </span>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                overflow: "hidden",
              }}
            >
              {[
                "Light and breathable for high humidity",
                "Neutral tones that don't trap heat",
                "Easy to move in for daily activities",
                "Effortless style with trendy touches",
              ].map((reason) => (
                <div
                  key={reason}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "6px",
                    flex: "1 1 0",
                    minHeight: 0,
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      fontSize: "10px",
                      lineHeight: 1,
                      paddingTop: "2px",
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.7)",
                      fontSize: "10px",
                      lineHeight: 1.4,
                      overflow: "hidden",
                    }}
                  >
                    {reason}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
