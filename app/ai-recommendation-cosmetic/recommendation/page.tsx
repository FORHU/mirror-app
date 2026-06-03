"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import "../../../styles/glow.css";
import WeatherWidget from "@/components/WeatherWidget";
import {
  cosmeticsService,
  type SkinAnalysis,
} from "@/modules/shared/api/cosmetics.service";
import { ACCESS_TOKEN } from "@/modules/shared/constants/storage-keys";
import { getStorageData } from "@/modules/shared/utils/storage";
import { ROUTES } from "@/navigation";

// ── ChatWonder product shape ──────────────────────────────────────────────────
type CWProduct = {
  id: string;
  name: string;
  description?: string;
  type?: string;
  reason?: string;
  imageUrl?: string;
  score?: number;
};

// Build the skin_analysis payload ChatWonder expects from a SkinAnalysis object
function toSkinPayload(a: SkinAnalysis) {
  const output: { type: string; ui_score: number }[] = [
    { type: "oiliness", ui_score: a.oilinessPct },
    { type: "moisture", ui_score: Math.round(100 - a.hydrationPct) },
  ];
  const c = a.concerns ?? [];
  if (c.some((x) => /acne/i.test(x)))
    output.push({ type: "acne", ui_score: 68 });
  if (c.some((x) => /wrinkle|fine line/i.test(x)))
    output.push({ type: "wrinkle", ui_score: 68 });
  if (c.some((x) => /dark circle/i.test(x)))
    output.push({ type: "dark_circle_v2", ui_score: 68 });
  if (c.some((x) => /age spot|hyperpig/i.test(x)))
    output.push({ type: "age_spot", ui_score: 68 });
  if (c.some((x) => /pore/i.test(x)))
    output.push({ type: "pore", ui_score: 68 });
  if (c.some((x) => /redness|sensitiv/i.test(x)))
    output.push({ type: "redness", ui_score: 78 });
  if (c.some((x) => /puffiness|eye bag/i.test(x)))
    output.push({ type: "eye_bag", ui_score: 70 });
  return { output };
}

async function fetchCWRecs(
  analysis: SkinAnalysis,
): Promise<CWProduct[] | null> {
  try {
    let token = await getStorageData<string>(ACCESS_TOKEN);
    if (!token && typeof window !== "undefined") {
      token =
        window.location.hostname === process.env.NEXT_PUBLIC_DOMAIN2
          ? (process.env.NEXT_PUBLIC_USER2_ACCESS_TOKEN ?? null)
          : (process.env.NEXT_PUBLIC_USER1_ACCESS_TOKEN ?? null);
    }

    const input =
      `[cosmetics] Recommend the best products for my ${analysis.skinType.toLowerCase()} skin. ` +
      `Concerns: ${analysis.concerns.join(", ") || "general maintenance"}.`;

    const res = await fetch("/api/mirror/chat-wonder/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-platform": "kiosk",
      },
      body: JSON.stringify({ input, skin_analysis: toSkinPayload(analysis) }),
    });

    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (
            event.type === "complete" &&
            event.sets?.[0]?.recommendations?.length
          ) {
            return event.sets[0].recommendations as CWProduct[];
          }
        } catch {
          /* keep reading */
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function inferSeverity(label: string): "low" | "medium" | "high" {
  const l = label.toLowerCase();
  if (/severe|significant|deep|chronic/.test(l)) return "high";
  if (/moderate|enlarged|uneven|excess/.test(l)) return "medium";
  return "low";
}

function toTitleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Fallback analysis when the backend upload/analyze fails, so products still load.
const MOCK_ANALYSIS: SkinAnalysis = {
  id: "mock",
  skinType: "Normal",
  skinTone: "medium",
  hydrationPct: 55,
  oilinessPct: 40,
  concerns: [],
  routineTip: "",
  recommendations: [],
};

// ── Skeleton product card — shown while analyzing / fetching ──────────────────
function SkeletonCard({ delay }: { delay: number }) {
  const shimmer = {
    animate: { opacity: [0.35, 0.7, 0.35] },
    transition: {
      duration: 1.4,
      repeat: Infinity,
      delay,
      ease: "easeInOut" as const,
    },
  };
  return (
    <div
      style={{
        borderRadius: "14px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <motion.div
        {...shimmer}
        style={{ flex: "0 0 52%", background: "rgba(255,255,255,0.06)" }}
      />
      <div
        style={{
          flex: 1,
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          justifyContent: "center",
        }}
      >
        <motion.div
          {...shimmer}
          style={{
            height: 7,
            width: "55%",
            borderRadius: 4,
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <motion.div
          {...shimmer}
          style={{
            height: 9,
            width: "85%",
            borderRadius: 4,
            background: "rgba(255,255,255,0.10)",
          }}
        />
        <motion.div
          {...shimmer}
          style={{
            height: 7,
            width: "40%",
            borderRadius: 4,
            background: "rgba(255,255,255,0.06)",
          }}
        />
      </div>
    </div>
  );
}

const SEVERITY_OPACITY: Record<string, number> = {
  high: 0.9,
  medium: 0.55,
  low: 0.3,
};

// ── Mock products ─────────────────────────────────────────────────────────────
type Product = {
  id: string;
  name: string;
  brand: string;
  category: string;
  use: string;
  score: number;
  reason: string;
  imageUrl: string | null;
};

const MOCK_PRODUCTS: Product[] = [
  {
    id: "m1",
    name: "Ultra Facial Cream",
    brand: "Kiehl's",
    category: "Moisturizer",
    use: "AM/PM",
    score: 96,
    reason: "Intensely hydrates dry skin",
    imageUrl: null,
  },
  {
    id: "m2",
    name: "Vitamin C Brightening Serum",
    brand: "Paula's Choice",
    category: "Serum",
    use: "AM",
    score: 93,
    reason: "Fades hyperpigmentation",
    imageUrl: null,
  },
  {
    id: "m3",
    name: "Invisible Shield SPF 35",
    brand: "Glossier",
    category: "Sunscreen",
    use: "AM",
    score: 91,
    reason: "Lightweight daily protection",
    imageUrl: null,
  },
  {
    id: "m4",
    name: "Gentle Foaming Cleanser",
    brand: "CeraVe",
    category: "Cleanser",
    use: "AM/PM",
    score: 89,
    reason: "Non-stripping, fragrance-free",
    imageUrl: null,
  },
  {
    id: "m5",
    name: "Retinol Eye Cream",
    brand: "RoC",
    category: "Eye Cream",
    use: "PM",
    score: 87,
    reason: "Reduces fine lines around eyes",
    imageUrl: null,
  },
  {
    id: "m6",
    name: "BHA Liquid Exfoliant",
    brand: "Paula's Choice",
    category: "Exfoliant",
    use: "PM",
    score: 85,
    reason: "Unclogs and minimises pores",
    imageUrl: null,
  },
  {
    id: "m7",
    name: "Hyaluronic Acid Serum",
    brand: "The Ordinary",
    category: "Serum",
    use: "AM/PM",
    score: 83,
    reason: "Deep moisture retention",
    imageUrl: null,
  },
  {
    id: "m8",
    name: "Clay Detox Mask",
    brand: "Fresh",
    category: "Mask",
    use: "Weekly",
    score: 80,
    reason: "Draws out excess oil",
    imageUrl: null,
  },
  {
    id: "m9",
    name: "Squalane Facial Oil",
    brand: "Biossance",
    category: "Face Oil",
    use: "PM",
    score: 78,
    reason: "Balances oily-dry skin",
    imageUrl: null,
  },
];

const PAGE_SIZE = 3;

// ── Clock ─────────────────────────────────────────────────────────────────────
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
export default function CosmeticRecommendationPage() {
  const router = useRouter();
  const now = useClock();

  type SessionData = {
    capturedImage: string | null;
    analysis: SkinAnalysis | null;
  };
  const [session, setSession] = useState<SessionData>({
    capturedImage: null,
    analysis: null,
  });
  const { capturedImage, analysis } = session;
  const [page, setPage] = useState(0);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [cwProducts, setCwProducts] = useState<CWProduct[] | null>(null);
  const [cwLoading, setCwLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Runs the whole pipeline that used to live on the (now-removed) result page:
  // upload the capture → analyze the skin → then fetch product recommendations.
  // The skeleton grid shows for the entire wait.
  useEffect(() => {
    const fetchRecs = (a: SkinAnalysis) => {
      setCwLoading(true);
      fetchCWRecs(a)
        .then((recs) => {
          if (recs?.length) setCwProducts(recs);
        })
        .finally(() => setCwLoading(false));
    };

    const applyAnalysis = (a: SkinAnalysis) => {
      try {
        sessionStorage.setItem("skin_analysis", JSON.stringify(a));
      } catch {}
      setSession((prev) => ({ ...prev, analysis: a }));
      fetchRecs(a);
    };

    try {
      const capturedImage = sessionStorage.getItem("skin_capture");
      const rawAnalysis = sessionStorage.getItem("skin_analysis");
      const existing = rawAnalysis
        ? (JSON.parse(rawAnalysis) as SkinAnalysis)
        : null;
      const existingId = !existing
        ? sessionStorage.getItem("skin_analysis_id")
        : null;

      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is browser-only; effect is the correct place to read it
      setSession({ capturedImage, analysis: existing });

      if (existing) {
        fetchRecs(existing);
      } else if (existingId) {
        // Resume a previously-started analysis by ID
        setAnalyzing(true);
        cosmeticsService
          .getAnalysis(existingId)
          .then(applyAnalysis)
          .catch(() => applyAnalysis(MOCK_ANALYSIS))
          .finally(() => setAnalyzing(false));
      } else if (capturedImage) {
        // Fresh capture — upload, analyze, then recommend
        setAnalyzing(true);
        cosmeticsService
          .uploadCapture(capturedImage)
          .then(({ id }) => cosmeticsService.analyzeSkin(id))
          .then(applyAnalysis)
          .catch(() => applyAnalysis(MOCK_ANALYSIS))
          .finally(() => setAnalyzing(false));
      }
    } catch {}
  }, []);

  const concerns = useMemo(
    () =>
      (analysis?.concerns ?? []).map((c) => ({
        label: c,
        severity: inferSeverity(c),
      })),
    [analysis],
  );

  // Compact skin summary shown above the product grid (replaces the result page).
  const skin = useMemo(
    () =>
      analysis
        ? {
            skinType: toTitleCase(analysis.skinType),
            skinTone: analysis.skinTone ?? "medium",
            hydration: analysis.hydrationPct,
            oiliness: analysis.oilinessPct,
          }
        : null,
    [analysis],
  );

  // ── Products — prefer ChatWonder results, fall back to rule engine, then mock
  const allProducts: Product[] = cwProducts?.length
    ? cwProducts.map((cw, i) => ({
        id: cw.id,
        name: cw.name,
        brand: "",
        category: cw.type ?? "Skincare",
        use: "Daily",
        score: cw.score ?? Math.max(95 - i * 3, 70),
        reason: cw.reason ?? cw.description ?? "",
        imageUrl: cw.imageUrl ?? null,
      }))
    : analysis?.recommendations?.length
      ? analysis.recommendations.map((r) => ({
          id: r.cosmeticProduct.id,
          name: r.cosmeticProduct.name,
          brand: r.cosmeticProduct.brand ?? "",
          category:
            r.cosmeticProduct.category ?? r.cosmeticProduct.type ?? "Product",
          use:
            r.cosmeticProduct.tags
              ?.find((t: string) =>
                /^(am|pm|am\/pm|daily|morning|evening)/i.test(t),
              )
              ?.toUpperCase() ?? "Daily",
          score: r.score ?? 80,
          reason: r.reason?.split(",")[0]?.trim() ?? "",
          imageUrl: r.cosmeticProduct.fileUrl?.fileUrl ?? null,
        }))
      : MOCK_PRODUCTS;
  const products = allProducts.filter(
    (product) =>
      product.imageUrl &&
      !failedImageIds.has(product.id) &&
      product.name.toLowerCase() !== "example product" &&
      product.brand.toLowerCase() !== "example brand",
  );

  const totalPages = Math.ceil(products.length / PAGE_SIZE);
  const pagedProducts = products.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  // Still working (analyzing skin or fetching recs) and nothing to show yet.
  const busy = (analyzing || cwLoading) && products.length === 0;
  const swipe = useSwipe(
    () => setPage((p) => Math.min(p + 1, totalPages - 1)),
    () => setPage((p) => Math.max(p - 1, 0)),
  );

  if (totalPages > 0 && page > totalPages - 1) {
    setPage(totalPages - 1);
  } else if (totalPages === 0 && page !== 0) {
    setPage(0);
  }

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString([], { weekday: "long" });
  const date = now.toLocaleDateString([], { month: "long", day: "numeric" });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      {/* Header */}
      <header
        className="flex items-center shrink-0 py-4 px-4"
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
        <div style={{ flex: "0 0 25%", display: "flex", alignItems: "center" }}>
          <WeatherWidget iconSize={32} />
        </div>
        <div
          style={{
            flex: "0 0 50%",
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
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => router.push(ROUTES.AI_RECOMMENDATION_COSMETIC)}
            className="p-4 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
        {/* Photo — centered, clean, concern chips overlaid at bottom */}
        <motion.div
          className="flex justify-center shrink-0 px-4 pt-3"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            style={{
              position: "relative",
              height: "32vh",
              aspectRatio: "3 / 4",
              borderRadius: "14px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
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
                <span
                  style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px" }}
                >
                  No capture
                </span>
              </div>
            )}

            {/* AI concern chips overlaid at photo bottom */}
            {concerns.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "20px 8px 8px",
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px",
                }}
              >
                {concerns.map((c) => (
                  <span
                    key={c.label}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.20)",
                      color: `rgba(255,255,255,${SEVERITY_OPACITY[c.severity]})`,
                      fontSize: "9px",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Compact skin summary (moved here from the old result page) ─────── */}
        <div className="shrink-0 px-4 pt-3">
          <div
            style={{
              borderRadius: "12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "10px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {skin ? (
                <>
                  <span
                    style={{
                      color: "white",
                      fontSize: "16px",
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {skin.skinType}
                  </span>
                  <span
                    style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}
                  >
                    {skin.skinTone}
                  </span>
                </>
              ) : (
                <motion.div
                  animate={{ opacity: [0.35, 0.7, 0.35] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{
                    height: 12,
                    width: "40%",
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.1)",
                  }}
                />
              )}
            </div>

            {(
              [
                { label: "Hydration", value: skin?.hydration ?? 0 },
                { label: "Oiliness", value: skin?.oiliness ?? 0 },
              ] as const
            ).map(({ label, value }) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    color: "rgba(255,255,255,0.38)",
                    fontSize: "10px",
                    width: "56px",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "3px",
                    borderRadius: "9999px",
                    background: "rgba(255,255,255,0.1)",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: skin ? `${value}%` : "0%" }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    style={{
                      height: "100%",
                      borderRadius: "9999px",
                      background: "rgba(255,255,255,0.75)",
                    }}
                  />
                </div>
                <span
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: "12px",
                    fontWeight: 600,
                    width: "30px",
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {skin ? `${value}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Product grid ─────────────────────────────────────────────────── */}
        <div
          className="flex-1 px-4 pb-3 pt-3"
          style={{
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Title row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {cwProducts?.length ? "AI Picks" : "Recommended Products"}
            </span>
            {(analyzing || cwLoading) && (
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ color: "rgba(72,199,142,0.8)", fontSize: "10px" }}
              >
                {analyzing ? "✦ analyzing skin…" : "✦ personalizing…"}
              </motion.span>
            )}
            <span
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: "12px",
                padding: "1px 8px",
                borderRadius: "9999px",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {products.length}
            </span>
            {totalPages > 1 && (
              <span
                style={{
                  marginLeft: "auto",
                  color: "rgba(255,255,255,0.25)",
                  fontSize: "11px",
                }}
              >
                {page + 1} / {totalPages}
              </span>
            )}
          </div>

          {/* Grid */}
          <div
            {...swipe}
            style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(1, 1fr)",
              gap: "10px",
              userSelect: "none",
              cursor: "grab",
              touchAction: "pan-y",
            }}
          >
            {busy
              ? [0, 1, 2].map((i) => (
                  <SkeletonCard key={`sk-${i}`} delay={i * 0.2} />
                ))
              : pagedProducts.map((product, i) => (
                  <motion.div
                    key={product.id}
                    style={{
                      borderRadius: "14px",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      minHeight: 0,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    initial={{ opacity: 0, scale: 0.96, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                  >
                    {/* Image area */}
                    <div
                      style={{
                        flex: "0 0 52%",
                        position: "relative",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      {product.imageUrl && !failedImageIds.has(product.id) ? (
                        <Image
                          fill
                          unoptimized
                          src={product.imageUrl}
                          alt={product.name}
                          draggable={false}
                          onError={() =>
                            setFailedImageIds((current) => {
                              const next = new Set(current);
                              next.add(product.id);
                              return next;
                            })
                          }
                          style={{ objectFit: "contain" }}
                          className="pointer-events-none"
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "5px",
                            background:
                              "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.05) 100%)",
                          }}
                        >
                          <span
                            style={{
                              color: "rgba(255,255,255,0.12)",
                              fontSize: "22px",
                              lineHeight: 1,
                            }}
                          >
                            ◯
                          </span>
                          <span
                            style={{
                              color: "rgba(255,255,255,0.18)",
                              fontSize: "8px",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                            }}
                          >
                            {product.category}
                          </span>
                        </div>
                      )}
                      {/* Score */}
                      <div
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          padding: "2px 7px",
                          borderRadius: "9999px",
                          background: "rgba(0,0,0,0.55)",
                          backdropFilter: "blur(4px)",
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <span
                          style={{
                            color: "rgba(255,255,255,0.9)",
                            fontSize: "10px",
                            fontWeight: 700,
                          }}
                        >
                          {product.score}%
                        </span>
                      </div>
                    </div>

                    {/* Text area */}
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        padding: "8px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          color: "rgba(255,255,255,0.3)",
                          fontSize: "8px",
                          textTransform: "uppercase",
                          letterSpacing: "0.09em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {product.category} · {product.use}
                      </span>
                      <span
                        style={{
                          color: "white",
                          fontSize: "12px",
                          fontWeight: 600,
                          lineHeight: 1.3,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {product.name}
                      </span>
                      <span
                        style={{
                          color: "rgba(255,255,255,0.38)",
                          fontSize: "10px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {product.brand}
                      </span>
                      {product.reason && (
                        <span
                          style={{
                            color: "rgba(255,255,255,0.45)",
                            fontSize: "9px",
                            lineHeight: 1.35,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            marginTop: "1px",
                          }}
                        >
                          {product.reason}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
          </div>

          {/* Pagination dots */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "6px",
                flexShrink: 0,
                paddingBottom: "2px",
              }}
            >
              {Array.from({ length: totalPages }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => setPage(i)}
                  style={{
                    width: i === page ? "16px" : "5px",
                    height: "5px",
                    borderRadius: "9999px",
                    background:
                      i === page
                        ? "rgba(255,255,255,0.8)"
                        : "rgba(255,255,255,0.2)",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
