"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import "../../../styles/glow.css";
import WeatherWidget from "@/components/WeatherWidget";
import { cosmeticsService, type SkinAnalysis } from "@/modules/shared/api/cosmetics.service";
import { ROUTES } from "@/navigation";

// ── Skin tone label → hex ─────────────────────────────────────────────────────
const SKIN_TONE_HEX: Record<string, string> = {
  "warm light": "#F5C5A3",
  "cool light": "#F0C1AC",
  "neutral light": "#F2C4AE",
  "warm medium": "#C8956C",
  "cool medium": "#B07B5B",
  "neutral medium": "#BC8866",
  "warm deep": "#7C4A2D",
  "cool deep": "#6B3D2A",
  "neutral deep": "#714030",
  "warm dark": "#4A2A1A",
  "cool dark": "#3D2318",
  "neutral dark": "#44281C",
};

function toneHex(label: string | null): string {
  if (!label) return "#C8956C";
  return SKIN_TONE_HEX[label.toLowerCase()] ?? "#C8956C";
}

// ── Severity from concern label text ─────────────────────────────────────────
function inferSeverity(label: string): "low" | "medium" | "high" {
  const l = label.toLowerCase();
  if (l.includes("severe") || l.includes("significant") || l.includes("deep") || l.includes("chronic"))
    return "high";
  if (l.includes("moderate") || l.includes("enlarged") || l.includes("uneven") || l.includes("excess"))
    return "medium";
  return "low";
}

// ── AM/PM use from product tags ───────────────────────────────────────────────
function inferUse(tags: string[]): string {
  const match = tags.find((t) => /^(am|pm|am\/pm|daily|morning|evening)/i.test(t));
  if (!match) return "Daily";
  return match.toUpperCase().replace("MORNING", "AM").replace("EVENING", "PM");
}

// ── Title-case enum value ─────────────────────────────────────────────────────
function toTitleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ── Severity dot color ────────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  low: "rgba(250,204,21,0.85)",
  medium: "rgba(251,146,60,0.85)",
  high: "rgba(248,113,113,0.85)",
};

const PRODUCT_PAGE_SIZE = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CosmeticResultPage() {
  const router = useRouter();
  const now = useClock();

  const [capturedImage] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("skin_capture");
    } catch {
      return null;
    }
  });

  const [analysis, setAnalysis] = useState<SkinAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [productPage, setProductPage] = useState(0);

  useEffect(() => {
    // Use result cached by capture page if available
    try {
      const cached = sessionStorage.getItem("skin_analysis");
      if (cached) {
        setAnalysis(JSON.parse(cached) as SkinAnalysis);
        setLoading(false);
        return;
      }
    } catch {}

    // Fallback: fetch by stored ID
    const id = sessionStorage.getItem("skin_analysis_id");
    if (!id) {
      setLoading(false);
      return;
    }
    cosmeticsService
      .getAnalysis(id)
      .then((data) => setAnalysis(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Map API response → UI shape ───────────────────────────────────────────
  const skin = analysis
    ? {
        skinType: toTitleCase(analysis.skinType),
        skinTone: {
          label: analysis.skinTone ?? "Medium",
          hex: toneHex(analysis.skinTone),
        },
        hydration: analysis.hydrationPct,
        oiliness: analysis.oilinessPct,
        concerns: analysis.concerns.map((c) => ({
          label: c,
          severity: inferSeverity(c),
        })),
        routineTip: analysis.routineTip,
      }
    : null;

  const products = (analysis?.recommendations ?? []).map((r) => ({
    id: r.cosmeticProduct.id,
    name: r.cosmeticProduct.name,
    brand: r.cosmeticProduct.brand ?? "",
    category: r.cosmeticProduct.category ?? r.cosmeticProduct.type ?? "Product",
    use: inferUse(r.cosmeticProduct.tags),
    why: r.reason
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2),
    imageUrl: r.cosmeticProduct.fileUrl?.fileUrl ?? null,
  }));

  const totalProductPages = Math.ceil(products.length / PRODUCT_PAGE_SIZE);
  const pagedProducts = products.slice(
    productPage * PRODUCT_PAGE_SIZE,
    (productPage + 1) * PRODUCT_PAGE_SIZE,
  );

  const productSwipe = useSwipe(
    () => setProductPage((p) => Math.min(p + 1, totalProductPages - 1)),
    () => setProductPage((p) => Math.max(p - 1, 0)),
  );

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString([], { weekday: "long" });
  const date = now.toLocaleDateString([], { month: "long", day: "numeric" });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      {/* Header — 25/50/25 columns */}
      <header
        className="flex items-center shrink-0 py-4 px-4"
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
          }}
        >
          <span
            className="text-white font-thin select-none"
            style={{ fontSize: "2rem", lineHeight: 1 }}
          >
            {time}
          </span>
          <span className="text-white/60 text-sm font-light select-none">
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
            onClick={() => router.push(ROUTES.LOGGED_IN)}
            className="p-4 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        </div>
      </header>

      {/* Body — 3 columns */}
      <div className="flex flex-1" style={{ height: "546px", minHeight: 0 }}>
        {/* Left panel — Captured photo + Skin Analysis */}
        <div
          className="h-full flex flex-col p-2 gap-2 min-h-0"
          style={{ flex: "0 0 30%", width: "30%" }}
        >
          {/* Captured photo — fixed 9:16 portrait ratio */}
          <div
            style={{
              width: "100%",
              aspectRatio: "9 / 16",
              borderRadius: "10px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
              flexShrink: 0,
              position: "relative",
            }}
          >
            {capturedImage ? (
              <Image
                fill
                unoptimized
                src={capturedImage}
                alt="Skin capture"
                style={{
                  objectFit: "cover",
                  objectPosition: "center top",
                  transform: "scaleX(-1)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "11px" }}>
                  No capture
                </span>
              </div>
            )}
          </div>

          {/* Skin Analysis — compact */}
          <div
            style={{
              flex: 2,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: "7px",
              overflow: "hidden",
              padding: "2px 4px",
            }}
          >
            {loading ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "10px" }}>
                  Loading analysis…
                </span>
              </div>
            ) : skin ? (
              <>
                {/* Skin type + tone */}
                <div
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ color: "white", fontSize: "11px", fontWeight: 600 }}>
                    {skin.skinType} Skin
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "50%",
                        background: skin.skinTone.hex,
                        border: "1px solid rgba(255,255,255,0.25)",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px" }}>
                      {skin.skinTone.label}
                    </span>
                  </div>
                </div>

                {/* Hydration bar */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Hydration
                    </span>
                    <span style={{ color: "rgba(96,165,250,0.9)", fontSize: "8px", fontWeight: 700 }}>
                      {skin.hydration}%
                    </span>
                  </div>
                  <div style={{ height: "3px", borderRadius: "9999px", background: "rgba(255,255,255,0.1)" }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: "9999px",
                        background: "rgba(96,165,250,0.85)",
                        width: `${skin.hydration}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Oiliness bar */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Oiliness
                    </span>
                    <span style={{ color: "rgba(251,146,60,0.9)", fontSize: "8px", fontWeight: 700 }}>
                      {skin.oiliness}%
                    </span>
                  </div>
                  <div style={{ height: "3px", borderRadius: "9999px", background: "rgba(255,255,255,0.1)" }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: "9999px",
                        background: "rgba(251,146,60,0.85)",
                        width: `${skin.oiliness}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Concerns */}
                {skin.concerns.length > 0 && (
                  <div style={{ flexShrink: 0, overflow: "hidden" }}>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Concerns
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "5px" }}>
                      {skin.concerns.map((c) => (
                        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <div
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "50%",
                              background: SEVERITY_COLOR[c.severity],
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "9px" }}>
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Routine tip */}
                {skin.routineTip && (
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "6px",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span
                      style={{
                        color: "rgba(255,255,255,0.35)",
                        fontSize: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        display: "block",
                        marginBottom: "3px",
                      }}
                    >
                      Tip
                    </span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.55)",
                        fontSize: "8px",
                        lineHeight: 1.4,
                        display: "block",
                      }}
                    >
                      {skin.routineTip}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>
                  No analysis data
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Center panel — empty mirror space */}
        <div style={{ flex: "0 0 40%", width: "40%", minHeight: 0 }} />

        {/* Right panel — Paged product list */}
        <div
          className="h-full flex flex-col p-2 gap-1 min-h-0"
          style={{ flex: "0 0 30%", width: "30%" }}
        >
          <SectionTitle label="Products" />

          {loading ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "10px" }}>
                Loading products…
              </span>
            </div>
          ) : products.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>
                No recommendations
              </span>
            </div>
          ) : (
            <>
              {/* Swipeable product list */}
              <div
                {...productSwipe}
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  overflow: "hidden",
                  touchAction: "pan-y",
                  userSelect: "none",
                  cursor: "grab",
                }}
              >
                {pagedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex glass-card-garment"
                    style={{
                      flex: 1,
                      minHeight: 0,
                      borderRadius: "10px",
                      overflow: "hidden",
                      alignItems: "stretch",
                    }}
                  >
                    {/* Left — photo 40% */}
                    <div
                      style={{
                        flex: "0 0 40%",
                        background: "rgba(255,255,255,0.01)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {product.imageUrl ? (
                        <Image
                          fill
                          unoptimized
                          src={product.imageUrl}
                          alt={product.name}
                          draggable={false}
                          className="object-contain pointer-events-none"
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            background: "rgba(255,255,255,0.03)",
                          }}
                        />
                      )}
                    </div>

                    {/* Right — text 60% */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "8px 8px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        gap: "4px",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          color: "rgba(255,255,255,0.4)",
                          fontSize: "8px",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                        }}
                      >
                        {product.category} · {product.use}
                      </span>
                      <span
                        style={{
                          color: "white",
                          fontSize: "10px",
                          fontWeight: 600,
                          lineHeight: 1.3,
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {product.name}
                      </span>
                      <span
                        style={{
                          color: "rgba(255,255,255,0.4)",
                          fontSize: "9px",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {product.brand}
                      </span>
                      {/* Why checkmarks */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                        {product.why.map((reason) => (
                          <div
                            key={reason}
                            style={{ display: "flex", gap: "3px", alignItems: "flex-start" }}
                          >
                            <span
                              style={{
                                color: "rgba(255,255,255,0.35)",
                                fontSize: "7px",
                                flexShrink: 0,
                                paddingTop: "1px",
                              }}
                            >
                              ✓
                            </span>
                            <span
                              style={{
                                color: "rgba(255,255,255,0.5)",
                                fontSize: "7px",
                                lineHeight: 1.35,
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
                ))}
              </div>

              {/* Dot indicator — only when multiple pages */}
              {totalProductPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "5px",
                    paddingBottom: "2px",
                    flexShrink: 0,
                  }}
                >
                  {Array.from({ length: totalProductPages }).map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setProductPage(i)}
                      style={{
                        width: i === productPage ? "14px" : "5px",
                        height: "5px",
                        borderRadius: "9999px",
                        background:
                          i === productPage
                            ? "rgba(255,255,255,0.85)"
                            : "rgba(255,255,255,0.2)",
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
