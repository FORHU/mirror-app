"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import "../../../styles/glow.css";
import WeatherWidget from "@/components/WeatherWidget";
import { type SkinAnalysis } from "@/modules/shared/api/cosmetics.service";
import { ROUTES } from "@/navigation";

function inferSeverity(label: string): "low" | "medium" | "high" {
  const l = label.toLowerCase();
  if (/severe|significant|deep|chronic/.test(l)) return "high";
  if (/moderate|enlarged|uneven|excess/.test(l)) return "medium";
  return "low";
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

  useEffect(() => {
    try {
      const capturedImage = sessionStorage.getItem("skin_capture");
      const rawAnalysis = sessionStorage.getItem("skin_analysis");
      const analysis = rawAnalysis
        ? (JSON.parse(rawAnalysis) as SkinAnalysis)
        : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is browser-only; effect is the correct place to read it
      setSession({ capturedImage, analysis });
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

  // ── Products ──────────────────────────────────────────────────────────────
  const allProducts: Product[] = analysis?.recommendations?.length
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
            onClick={() =>
              router.push(ROUTES.AI_RECOMMENDATION_COSMETIC_RESULT)
            }
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
              Recommended Products
            </span>
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
            {pagedProducts.map((product, i) => (
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
