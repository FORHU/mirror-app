"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import "../../../styles/glow.css";
import WeatherWidget from "@/components/WeatherWidget";
import { type SkinAnalysis } from "@/modules/shared/api/cosmetics.service";
import { ROUTES } from "@/navigation";

// ── Shared overlay logic (mirrors result page) ────────────────────────────────
type Landmark = { x: number; y: number; z: number };
type ZoneEntry = { zone: string; labels: string[]; severity: string; cx: number; cy: number };

function inferSeverity(label: string): "low" | "medium" | "high" {
  const l = label.toLowerCase();
  if (/severe|significant|deep|chronic/.test(l)) return "high";
  if (/moderate|enlarged|uneven|excess/.test(l)) return "medium";
  return "low";
}

const REGION_ANCHOR: Record<string, number> = {
  forehead: 10, left_cheek: 234, right_cheek: 454,
  nose: 4, left_eye_area: 133, right_eye_area: 362, chin: 152,
};

function getConcernZones(label: string): string[] {
  const l = label.toLowerCase();
  if (/pore|blackhead|whitehead/.test(l))               return ["nose", "left_cheek", "right_cheek"];
  if (/acne|breakout|pimple|blemish/.test(l))           return ["forehead", "chin", "left_cheek", "right_cheek"];
  if (/dark.circle|under.eye|puffin|puffy|bag/.test(l)) return ["left_eye_area", "right_eye_area"];
  if (/wrinkle|fine.line|crow|aging|age/.test(l))       return ["forehead", "left_eye_area", "right_eye_area"];
  if (/pigment|dark.spot|uneven|melasma|tone/.test(l))  return ["left_cheek", "right_cheek"];
  if (/dry|flak|dehydrat/.test(l))                      return ["left_cheek", "right_cheek"];
  if (/red|rosacea|inflam/.test(l))                     return ["left_cheek", "right_cheek", "nose"];
  if (/oil|shine|greasy/.test(l))                       return ["forehead", "nose", "chin"];
  if (/t.zone/.test(l))                                 return ["forehead", "nose"];
  return ["left_cheek", "right_cheek"];
}

const LABEL_ROW_H = 18;
const PILL_PAD_Y  = 4;
const MIN_GAP     = 8;
const LINE_OVERHANG = 20;

function resolveOverlaps(nodes: Array<{ cy: number; rowCount: number }>): number[] {
  const ys = nodes.map((n) => n.cy);
  const blockH = (n: { rowCount: number }) => n.rowCount * LABEL_ROW_H + PILL_PAD_Y * 2;
  for (let pass = 0; pass < 20; pass++) {
    let moved = false;
    for (let i = 0; i < ys.length - 1; i++) {
      for (let j = i + 1; j < ys.length; j++) {
        const botI = ys[i] + blockH(nodes[i]) / 2;
        const topJ = ys[j] - blockH(nodes[j]) / 2;
        const overlap = botI + MIN_GAP - topJ;
        if (overlap > 0) { ys[i] -= overlap / 2; ys[j] += overlap / 2; moved = true; }
      }
    }
    if (!moved) break;
  }
  return ys;
}

function FaceAnnotationOverlay({ entries, lyMap, width, height }: {
  entries: ZoneEntry[]; lyMap: Map<string, number>; width: number; height: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 2 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {entries.map((entry, idx) => {
        const { zone, cx, cy } = entry;
        const ly = lyMap.get(zone) ?? cy;
        const isLeft = cx < width * 0.5;
        const dotEdgeX = isLeft ? cx - 5 : cx + 5;
        const elbowX   = isLeft ? -LINE_OVERHANG : width + LINE_OVERHANG;
        return (
          <g key={zone}>
            <circle cx={cx} cy={cy} r={12} fill="rgba(255,255,255,0.08)" stroke="none">
              <animate attributeName="r"       values="6;14;6"    dur="2.2s" begin={`${idx * 0.35}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0;0.5" dur="2.2s" begin={`${idx * 0.35}s`} repeatCount="indefinite" />
            </circle>
            <circle cx={cx} cy={cy} r={4} fill="white" stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
            <line x1={dotEdgeX} y1={cy} x2={elbowX} y2={ly} stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

// ── Mock products ─────────────────────────────────────────────────────────────
type Product = { id: string; name: string; brand: string; category: string; use: string; score: number; reason: string; imageUrl: string | null; };

const MOCK_PRODUCTS: Product[] = [
  { id: "m1", name: "Ultra Facial Cream",          brand: "Kiehl's",        category: "Moisturizer", use: "AM/PM",   score: 96, reason: "Intensely hydrates dry skin",          imageUrl: null },
  { id: "m2", name: "Vitamin C Brightening Serum", brand: "Paula's Choice", category: "Serum",       use: "AM",      score: 93, reason: "Fades hyperpigmentation",               imageUrl: null },
  { id: "m3", name: "Invisible Shield SPF 35",     brand: "Glossier",       category: "Sunscreen",   use: "AM",      score: 91, reason: "Lightweight daily protection",          imageUrl: null },
  { id: "m4", name: "Gentle Foaming Cleanser",     brand: "CeraVe",         category: "Cleanser",    use: "AM/PM",   score: 89, reason: "Non-stripping, fragrance-free",         imageUrl: null },
  { id: "m5", name: "Retinol Eye Cream",           brand: "RoC",            category: "Eye Cream",   use: "PM",      score: 87, reason: "Reduces fine lines around eyes",        imageUrl: null },
  { id: "m6", name: "BHA Liquid Exfoliant",        brand: "Paula's Choice", category: "Exfoliant",   use: "PM",      score: 85, reason: "Unclogs and minimises pores",           imageUrl: null },
  { id: "m7", name: "Hyaluronic Acid Serum",       brand: "The Ordinary",   category: "Serum",       use: "AM/PM",   score: 83, reason: "Deep moisture retention",               imageUrl: null },
  { id: "m8", name: "Clay Detox Mask",             brand: "Fresh",          category: "Mask",        use: "Weekly",  score: 80, reason: "Draws out excess oil",                  imageUrl: null },
  { id: "m9", name: "Squalane Facial Oil",         brand: "Biossance",      category: "Face Oil",    use: "PM",      score: 78, reason: "Balances oily-dry skin",                imageUrl: null },
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
    onTouchStart: (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => {
      if (startX.current === null) return;
      const delta = e.changedTouches[0].clientX - startX.current;
      startX.current = null;
      if (delta < -40) onLeft(); else if (delta > 40) onRight();
    },
    onMouseDown: (e: React.MouseEvent) => { startX.current = e.clientX; },
    onMouseUp: (e: React.MouseEvent) => {
      if (startX.current === null) return;
      const delta = e.clientX - startX.current;
      startX.current = null;
      if (delta < -40) onLeft(); else if (delta > 40) onRight();
    },
    onMouseLeave: () => { startX.current = null; },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CosmeticRecommendationPage() {
  const router = useRouter();
  const now = useClock();

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[] | null>(null);
  const [analysis, setAnalysis] = useState<SkinAnalysis | null>(null);
  const [photoSize, setPhotoSize] = useState({ w: 0, h: 0 });
  const [page, setPage] = useState(0);
  const photoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCapturedImage(sessionStorage.getItem("skin_capture"));
      const rawLm = sessionStorage.getItem("skin_landmarks");
      if (rawLm) setLandmarks(JSON.parse(rawLm) as Landmark[]);
      const rawAnalysis = sessionStorage.getItem("skin_analysis");
      if (rawAnalysis) setAnalysis(JSON.parse(rawAnalysis) as SkinAnalysis);
    } catch {}
  }, []);

  useEffect(() => {
    const el = photoContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setPhotoSize({ w: el.clientWidth, h: el.clientHeight }));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Overlay zones ─────────────────────────────────────────────────────────
  const concerns = useMemo(
    () => (analysis?.concerns ?? []).map((c) => ({ label: c, severity: inferSeverity(c) })),
    [analysis],
  );

  const annotatedZones = useMemo<ZoneEntry[]>(() => {
    if (!landmarks || concerns.length === 0 || photoSize.w === 0) return [];
    const zoneMap = new Map<string, { labels: string[]; severity: string }>();
    for (const c of concerns) {
      for (const zone of getConcernZones(c.label)) {
        if (!zoneMap.has(zone)) zoneMap.set(zone, { labels: [], severity: c.severity });
        const entry = zoneMap.get(zone)!;
        if (!entry.labels.includes(c.label)) entry.labels.push(c.label);
        if (c.severity === "high" || (c.severity === "medium" && entry.severity === "low"))
          entry.severity = c.severity;
      }
    }
    return Array.from(zoneMap.entries()).map(([zone, data]) => {
      const anchorIdx = REGION_ANCHOR[zone];
      if (anchorIdx === undefined || anchorIdx >= landmarks.length) return null;
      const lm = landmarks[anchorIdx];
      return { zone, ...data, cx: (1 - lm.x) * photoSize.w, cy: lm.y * photoSize.h };
    }).filter(Boolean) as ZoneEntry[];
  }, [landmarks, concerns, photoSize]);

  const { leftEntries, rightEntries, lyMap } = useMemo(() => {
    if (photoSize.w === 0) return { leftEntries: [], rightEntries: [], lyMap: new Map<string, number>() };
    const left  = annotatedZones.filter((e) => e.cx <  photoSize.w * 0.5);
    const right = annotatedZones.filter((e) => e.cx >= photoSize.w * 0.5);
    const lResolved = resolveOverlaps(left.map((e)  => ({ cy: e.cy, rowCount: e.labels.length })));
    const rResolved = resolveOverlaps(right.map((e) => ({ cy: e.cy, rowCount: e.labels.length })));
    const lEntries = left.map((e, i)  => ({ ...e, ly: lResolved[i] }));
    const rEntries = right.map((e, i) => ({ ...e, ly: rResolved[i] }));
    const map = new Map<string, number>();
    lEntries.forEach((e) => map.set(e.zone, e.ly));
    rEntries.forEach((e) => map.set(e.zone, e.ly));
    return { leftEntries: lEntries, rightEntries: rEntries, lyMap: map };
  }, [annotatedZones, photoSize.w]);

  // ── Products ──────────────────────────────────────────────────────────────
  const products: Product[] = analysis?.recommendations?.length
    ? analysis.recommendations.map((r) => ({
        id: r.cosmeticProduct.id,
        name: r.cosmeticProduct.name,
        brand: r.cosmeticProduct.brand ?? "",
        category: r.cosmeticProduct.category ?? r.cosmeticProduct.type ?? "Product",
        use: r.cosmeticProduct.tags?.find((t: string) => /^(am|pm|am\/pm|daily|morning|evening)/i.test(t))?.toUpperCase() ?? "Daily",
        score: r.score ?? 80,
        reason: r.reason?.split(",")[0]?.trim() ?? "",
        imageUrl: r.cosmeticProduct.fileUrl?.fileUrl ?? null,
      }))
    : MOCK_PRODUCTS;

  const totalPages   = Math.ceil(products.length / PAGE_SIZE);
  const pagedProducts = products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const swipe = useSwipe(
    () => setPage((p) => Math.min(p + 1, totalPages - 1)),
    () => setPage((p) => Math.max(p - 1, 0)),
  );

  const panelH = photoSize.h > 0 ? `${photoSize.h}px` : "62vh";
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day  = now.toLocaleDateString([], { weekday: "long" });
  const date = now.toLocaleDateString([], { month: "long", day: "numeric" });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">

      {/* Header */}
      <header className="flex items-center shrink-0 py-4 px-4" style={{ background: "rgba(0,0,0,0.85)" }}>
        <div style={{ flex: "0 0 25%", display: "flex", alignItems: "center" }}>
          <WeatherWidget iconSize={32} />
        </div>
        <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span className="text-white font-thin select-none" style={{ fontSize: "2rem", lineHeight: 1 }}>{time}</span>
          <span className="text-white/60 text-sm font-light select-none">{day}, {date}</span>
        </div>
        <div style={{ flex: "0 0 25%", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => router.push(ROUTES.AI_RECOMMENDATION_COSMETIC_RESULT)}
            className="p-4 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>

        {/* ── Photo row: [left labels] [photo + annotation] [right labels] ─ */}
        <motion.div
          className="flex items-start shrink-0 pt-3"
          style={{ paddingLeft: "6px", paddingRight: "6px", gap: "4px" }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Left label panel */}
          <div style={{ flex: 1, minWidth: 0, position: "relative", height: panelH, zIndex: 1 }}>
            {photoSize.h > 0 && leftEntries.map((entry) => (
              <div key={entry.zone} style={{ position: "absolute", top: entry.ly, right: 0, transform: "translateY(-50%)" }}>
                <div style={{ padding: "4px 8px", borderRadius: "8px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", flexDirection: "column", gap: "2px" }}>
                  {entry.labels.map((label) => (
                    <span key={label} style={{ color: "rgba(255,255,255,0.85)", fontSize: "10px", fontWeight: 500, whiteSpace: "nowrap" }}>{label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Photo */}
          <div
            ref={photoContainerRef}
            style={{ position: "relative", flexShrink: 0, aspectRatio: "9 / 16", height: "62vh", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}
          >
            <div style={{ position: "absolute", inset: 0, borderRadius: "16px", overflow: "hidden" }}>
              {capturedImage ? (
                <Image fill unoptimized src={capturedImage} alt="Skin capture" style={{ objectFit: "cover", objectPosition: "center top", transform: "scaleX(-1)" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No capture</span>
                </div>
              )}
            </div>
            <AnimatePresence>
              {photoSize.w > 0 && annotatedZones.length > 0 && (
                <FaceAnnotationOverlay entries={annotatedZones} lyMap={lyMap} width={photoSize.w} height={photoSize.h} />
              )}
            </AnimatePresence>
          </div>

          {/* Right label panel */}
          <div style={{ flex: 1, minWidth: 0, position: "relative", height: panelH }}>
            {photoSize.h > 0 && rightEntries.map((entry) => (
              <div key={entry.zone} style={{ position: "absolute", top: entry.ly, left: 0, transform: "translateY(-50%)" }}>
                <div style={{ padding: "4px 8px", borderRadius: "8px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", flexDirection: "column", gap: "2px" }}>
                  {entry.labels.map((label) => (
                    <span key={label} style={{ color: "rgba(255,255,255,0.85)", fontSize: "10px", fontWeight: 500, whiteSpace: "nowrap" }}>{label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Product grid ─────────────────────────────────────────────────── */}
        <div className="flex-1 px-4 pb-3 pt-3" style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: "8px" }}>

          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "14px", fontWeight: 600 }}>Recommended Products</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", padding: "1px 8px", borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.1)" }}>
              {products.length}
            </span>
            {totalPages > 1 && (
              <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.25)", fontSize: "11px" }}>
                {page + 1} / {totalPages}
              </span>
            )}
          </div>

          {/* Grid */}
          <div
            {...swipe}
            style={{
              flex: 1, minHeight: 0,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(1, 1fr)",
              gap: "10px",
              userSelect: "none", cursor: "grab", touchAction: "pan-y",
            }}
          >
            {pagedProducts.map((product, i) => (
              <motion.div
                key={product.id}
                style={{ borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                {/* Image area */}
                <div style={{ flex: "0 0 52%", position: "relative", background: "rgba(255,255,255,0.03)" }}>
                  {product.imageUrl ? (
                    <Image fill unoptimized src={product.imageUrl} alt={product.name} draggable={false} style={{ objectFit: "contain" }} className="pointer-events-none" />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "rgba(255,255,255,0.1)", fontSize: "10px" }}>{product.category}</span>
                    </div>
                  )}
                  {/* Score */}
                  <div style={{ position: "absolute", top: "6px", right: "6px", padding: "2px 7px", borderRadius: "9999px", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "10px", fontWeight: 700 }}>{product.score}%</span>
                  </div>
                </div>

                {/* Text area */}
                <div style={{ flex: 1, minHeight: 0, padding: "8px 10px", display: "flex", flexDirection: "column", gap: "3px", overflow: "hidden" }}>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.09em", whiteSpace: "nowrap" }}>
                    {product.category} · {product.use}
                  </span>
                  <span style={{ color: "white", fontSize: "12px", fontWeight: 600, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {product.name}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.38)", fontSize: "10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {product.brand}
                  </span>
                  {product.reason && (
                    <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "9px", lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginTop: "1px" }}>
                      {product.reason}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination dots */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", flexShrink: 0, paddingBottom: "2px" }}>
              {Array.from({ length: totalPages }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => setPage(i)}
                  style={{ width: i === page ? "16px" : "5px", height: "5px", borderRadius: "9999px", background: i === page ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)", transition: "all 0.3s ease", cursor: "pointer" }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
