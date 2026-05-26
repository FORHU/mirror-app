"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import "../../../styles/glow.css";
import WeatherWidget from "@/components/WeatherWidget";
import {
  cosmeticsService,
  type SkinAnalysis,
} from "@/modules/shared/api/cosmetics.service";
import { ROUTES } from "@/navigation";

function inferSeverity(label: string): "low" | "medium" | "high" {
  const l = label.toLowerCase();
  if (/severe|significant|deep|chronic/.test(l)) return "high";
  if (/moderate|enlarged|uneven|excess/.test(l)) return "medium";
  return "low";
}
function toTitleCase(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

// Severity expressed through white opacity only
const SEVERITY_OPACITY: Record<string, number> = { high: 0.9, medium: 0.55, low: 0.3 };

// ── Face region anchor landmarks (MediaPipe FaceMesh 468-point) ───────────────
const REGION_ANCHOR: Record<string, number> = {
  forehead:       10,
  left_cheek:     234,
  right_cheek:    454,
  nose:           4,
  left_eye_area:  133,
  right_eye_area: 362,
  chin:           152,
};

// ── Concern label → zone keys ─────────────────────────────────────────────────
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

// ── Overlap resolver ──────────────────────────────────────────────────────────
type Landmark = { x: number; y: number; z: number };
type ZoneEntry = { zone: string; labels: string[]; severity: string; cx: number; cy: number };

const LABEL_ROW_H = 18;
const PILL_PAD_Y  = 4;
const MIN_GAP     = 8;
// How far the elbow line extends beyond the photo edge into the side panel
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
        if (overlap > 0) {
          ys[i] -= overlap / 2;
          ys[j] += overlap / 2;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return ys;
}

// ── Annotation overlay ────────────────────────────────────────────────────────
// Renders dots + elbow lines. The SVG uses overflow:visible so lines extend
// into the side panels. The photo container must NOT have overflow:hidden —
// the image is clipped separately in its own wrapper.
function FaceAnnotationOverlay({
  entries,
  lyMap,
  width,
  height,
}: {
  entries: ZoneEntry[];
  lyMap: Map<string, number>;
  width: number;
  height: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        overflow: "visible", pointerEvents: "none",
        zIndex: 2,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {entries.map((entry, idx) => {
        const { zone, cx, cy } = entry;
        const ly       = lyMap.get(zone) ?? cy;
        const isLeft   = cx < width * 0.5;
        const dotEdgeX = isLeft ? cx - 5 : cx + 5;
        const elbowX   = isLeft ? -LINE_OVERHANG : width + LINE_OVERHANG;

        return (
          <g key={zone}>
            {/* Pulse ring */}
            <circle cx={cx} cy={cy} r={12} fill="rgba(255,255,255,0.08)" stroke="none">
              <animate attributeName="r"       values="6;14;6"      dur="2.2s" begin={`${idx * 0.35}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0;0.5"   dur="2.2s" begin={`${idx * 0.35}s`} repeatCount="indefinite" />
            </circle>
            {/* Core dot */}
            <circle cx={cx} cy={cy} r={4} fill="white" stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
            {/* Diagonal line */}
            <line
              x1={dotEdgeX} y1={cy}
              x2={elbowX}   y2={ly}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CosmeticResultPage() {
  const router = useRouter();
  const now = useClock();

  type SessionData = { capturedImage: string | null; landmarks: Landmark[] | null; analysis: SkinAnalysis | null; loading: boolean };
  const [session, setSession] = useState<SessionData>({ capturedImage: null, landmarks: null, analysis: null, loading: false });
  const { capturedImage, landmarks, analysis, loading } = session;

  const [photoSize, setPhotoSize] = useState({ w: 0, h: 0 });
  const photoContainerRef = useRef<HTMLDivElement>(null);

  const goToRecommendation = useCallback(() => {
    router.push(ROUTES.AI_RECOMMENDATION_COSMETIC_RECOMMENDATION);
  }, [router]);

  // Read sessionStorage after mount to avoid SSR/client hydration mismatch
  useEffect(() => {
    try {
      const capturedImage = sessionStorage.getItem("skin_capture");
      const rawLm = sessionStorage.getItem("skin_landmarks");
      const landmarks = rawLm ? (JSON.parse(rawLm) as Landmark[]) : null;
      const rawAnalysis = sessionStorage.getItem("skin_analysis");
      const analysis = rawAnalysis ? (JSON.parse(rawAnalysis) as SkinAnalysis) : null;
      const id = !analysis ? sessionStorage.getItem("skin_analysis_id") : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is browser-only; effect is the correct place to read it
      setSession({ capturedImage, landmarks, analysis, loading: Boolean(id) });
      if (id) {
        cosmeticsService
          .getAnalysis(id)
          .then((data) => setSession((prev) => ({ ...prev, analysis: data, loading: false })))
          .catch(() => setSession((prev) => ({ ...prev, loading: false })));
      }
    } catch {}
  }, []);

  // Measure photo container for SVG coordinate space
  useEffect(() => {
    const el = photoContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setPhotoSize({ w: el.clientWidth, h: el.clientHeight });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const skin = useMemo(() => analysis ? {
    skinType: toTitleCase(analysis.skinType),
    skinTone: analysis.skinTone ?? "medium",
    hydration: analysis.hydrationPct,
    oiliness: analysis.oilinessPct,
    concerns: analysis.concerns.map((c) => ({ label: c, severity: inferSeverity(c) })),
    routineTip: analysis.routineTip,
  } : null, [analysis]);

  // ── Annotated zones ───────────────────────────────────────────────────────
  const annotatedZones = useMemo<ZoneEntry[]>(() => {
    if (!landmarks || !skin || photoSize.w === 0) return [];
    const zoneMap = new Map<string, { labels: string[]; severity: string }>();
    for (const c of skin.concerns) {
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
  }, [landmarks, skin, photoSize]);

  // ── Resolved y-positions split to left/right panels ──────────────────────
  const { leftEntries, rightEntries, lyMap } = useMemo(() => {
    if (photoSize.w === 0) return { leftEntries: [], rightEntries: [], lyMap: new Map<string, number>() };
    const left  = annotatedZones.filter((e) => e.cx <  photoSize.w * 0.5);
    const right = annotatedZones.filter((e) => e.cx >= photoSize.w * 0.5);
    const resolvedLeft  = resolveOverlaps(left.map((e)  => ({ cy: e.cy, rowCount: e.labels.length })));
    const resolvedRight = resolveOverlaps(right.map((e) => ({ cy: e.cy, rowCount: e.labels.length })));
    const lEntries = left.map((e, i)  => ({ ...e, ly: resolvedLeft[i] }));
    const rEntries = right.map((e, i) => ({ ...e, ly: resolvedRight[i] }));
    const map = new Map<string, number>();
    lEntries.forEach((e) => map.set(e.zone, e.ly));
    rEntries.forEach((e) => map.set(e.zone, e.ly));
    return { leftEntries: lEntries, rightEntries: rEntries, lyMap: map };
  }, [annotatedZones, photoSize.w]);

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day  = now.toLocaleDateString([], { weekday: "long" });
  const date = now.toLocaleDateString([], { month: "long", day: "numeric" });

  const panelH = photoSize.h > 0 ? `${photoSize.h}px` : "62vh";

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
        <div style={{ flex: "0 0 25%" }} />
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
          {/* Left panel — dots whose cx < photoW * 0.5 */}
          {/* z-index: 1 so pills render above the SVG lines that overflow here */}
          <div style={{ flex: 1, minWidth: 0, position: "relative", height: panelH, zIndex: 1 }}>
            {photoSize.h > 0 && leftEntries.map((entry) => (
              <div
                key={entry.zone}
                style={{ position: "absolute", top: entry.ly, right: 0, transform: "translateY(-50%)" }}
              >
                <div style={{
                  padding: "4px 8px", borderRadius: "8px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  display: "flex", flexDirection: "column", gap: "2px",
                }}>
                  {entry.labels.map((label) => (
                    <span key={label} style={{ color: "rgba(255,255,255,0.85)", fontSize: "10px", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Photo — no overflow:hidden so SVG elbow lines can spill into panels */}
          <div
            ref={photoContainerRef}
            style={{
              position: "relative",
              flexShrink: 0,
              aspectRatio: "9 / 16",
              height: "62vh",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
              // overflow:hidden intentionally removed; image is clipped by its own wrapper below
            }}
          >
            {/* Image wrapper — clips photo to rounded rect */}
            <div style={{ position: "absolute", inset: 0, borderRadius: "16px", overflow: "hidden" }}>
              {capturedImage ? (
                <Image
                  fill unoptimized
                  src={capturedImage}
                  alt="Skin capture"
                  style={{ objectFit: "cover", objectPosition: "center top", transform: "scaleX(-1)" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No capture</span>
                </div>
              )}
            </div>

            {/* Annotation SVG — overflow:visible draws elbow lines into side panels */}
            <AnimatePresence>
              {photoSize.w > 0 && annotatedZones.length > 0 && (
                <FaceAnnotationOverlay
                  entries={annotatedZones}
                  lyMap={lyMap}
                  width={photoSize.w}
                  height={photoSize.h}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Right panel — dots whose cx >= photoW * 0.5 */}
          <div style={{ flex: 1, minWidth: 0, position: "relative", height: panelH }}>
            {photoSize.h > 0 && rightEntries.map((entry) => (
              <div
                key={entry.zone}
                style={{ position: "absolute", top: entry.ly, left: 0, transform: "translateY(-50%)" }}
              >
                <div style={{
                  padding: "4px 8px", borderRadius: "8px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  display: "flex", flexDirection: "column", gap: "2px",
                }}>
                  {entry.labels.map((label) => (
                    <span key={label} style={{ color: "rgba(255,255,255,0.85)", fontSize: "10px", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Skin analysis results ────────────────────────────────────────── */}
        <div className="flex-1 px-4 pb-4 pt-3" style={{ minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          {loading ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Loading analysis…</span>
            </div>
          ) : skin ? (
            <motion.div
              style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {/* Summary card */}
              <div style={{
                borderRadius: "16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "14px 16px",
                display: "flex", flexDirection: "column", gap: "10px",
              }}>
                {/* Skin type + tone */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "white", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.01em" }}>
                    {skin.skinType}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>{skin.skinTone}</span>
                </div>

                {/* Hydration + Oiliness bars */}
                {([
                  { label: "Hydration", value: skin.hydration, delay: 0.4 },
                  { label: "Oiliness",  value: skin.oiliness,  delay: 0.55 },
                ] as const).map(({ label, value, delay }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: "rgba(255,255,255,0.38)", fontSize: "11px", width: "64px", flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: "3px", borderRadius: "9999px", background: "rgba(255,255,255,0.1)" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 0.7, delay, ease: "easeOut" }}
                        style={{ height: "100%", borderRadius: "9999px", background: "rgba(255,255,255,0.75)" }}
                      />
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", fontWeight: 600, width: "34px", textAlign: "right", flexShrink: 0 }}>
                      {value}<span style={{ fontSize: "10px", fontWeight: 400, opacity: 0.55 }}>%</span>
                    </span>
                  </div>
                ))}

                {/* Divider + routine tip */}
                {skin.routineTip && (
                  <>
                    <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", lineHeight: 1.55 }}>
                      {skin.routineTip}
                    </span>
                  </>
                )}
              </div>

              {/* Concerns — severity-grouped rows */}
              {skin.concerns.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(["high", "medium", "low"] as const).map((sev) => {
                    const items = skin.concerns.filter((c) => c.severity === sev).map((c) => c.label);
                    if (items.length === 0) return null;
                    return (
                      <div key={sev} style={{ display: "flex", alignItems: "stretch", gap: "10px" }}>
                        <div style={{ width: "2px", borderRadius: "9999px", background: `rgba(255,255,255,${SEVERITY_OPACITY[sev]})`, flexShrink: 0 }} />
                        <span style={{ color: `rgba(255,255,255,${SEVERITY_OPACITY[sev]})`, fontSize: "12px", lineHeight: 1.5, paddingTop: "1px" }}>
                          {items.join(" · ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CTA */}
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                <button
                  onClick={goToRecommendation}
                  style={{
                    width: "100%", padding: "14px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "white", fontSize: "14px", fontWeight: 500,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  }}
                >
                  See Recommended Products <ArrowRight style={{ width: "15px", height: "15px" }} />
                </button>
              </div>
            </motion.div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No analysis data</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
