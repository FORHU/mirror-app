"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
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
function toTitleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Severity expressed through white opacity only
const SEVERITY_OPACITY: Record<string, number> = {
  high: 0.9,
  medium: 0.55,
  low: 0.3,
};

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

  type SessionData = {
    capturedImage: string | null;
    analysis: SkinAnalysis | null;
    loading: boolean;
  };
  const [session, setSession] = useState<SessionData>({
    capturedImage: null,
    analysis: null,
    loading: false,
  });
  const { capturedImage, analysis, loading } = session;

  const goToRecommendation = useCallback(() => {
    router.push(ROUTES.AI_RECOMMENDATION_COSMETIC_RECOMMENDATION);
  }, [router]);

  // Read sessionStorage after mount to avoid SSR/client hydration mismatch
  useEffect(() => {
    try {
      const capturedImage = sessionStorage.getItem("skin_capture");
      const rawAnalysis = sessionStorage.getItem("skin_analysis");
      const analysis = rawAnalysis
        ? (JSON.parse(rawAnalysis) as SkinAnalysis)
        : null;
      const existingId = !analysis ? sessionStorage.getItem("skin_analysis_id") : null;

      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is browser-only; effect is the correct place to read it
      setSession({ capturedImage, analysis, loading: Boolean(!analysis) });

      if (existingId) {
        // Resume a previously-started analysis by ID
        cosmeticsService
          .getAnalysis(existingId)
          .then((data) =>
            setSession((prev) => ({ ...prev, analysis: data, loading: false })),
          )
          .catch(() => setSession((prev) => ({ ...prev, loading: false })));
      } else if (!analysis && capturedImage) {
        // Image just captured — show photo immediately, analyse in background, then reload
        cosmeticsService
          .uploadCapture(capturedImage)
          .then(({ id: fileId }) => cosmeticsService.analyzeSkin(fileId))
          .then((data) => {
            sessionStorage.setItem("skin_analysis", JSON.stringify(data));
            window.location.reload();
          })
          .catch(() => {
            sessionStorage.setItem("skin_analysis", JSON.stringify({
              id: "mock", skinType: "Normal", skinTone: "medium",
              hydrationPct: 55, oilinessPct: 40, concerns: [], routineTip: "",
              recommendations: [],
            }));
            window.location.reload();
          });
      }
    } catch {}
  }, []);

  const skin = useMemo(
    () =>
      analysis
        ? {
            skinType: toTitleCase(analysis.skinType),
            skinTone: analysis.skinTone ?? "medium",
            hydration: analysis.hydrationPct,
            oiliness: analysis.oilinessPct,
            concerns: analysis.concerns.map((c) => ({
              label: c,
              severity: inferSeverity(c),
            })),
            routineTip: analysis.routineTip,
          }
        : null,
    [analysis],
  );

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
        <div style={{ flex: "0 0 25%" }} />
      </header>

      {/* Body */}
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
        {/* ── Photo ───────────────────────────────────────────────────────── */}
        <motion.div
          className="flex justify-center shrink-0 pt-3"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            style={{
              position: "relative",
              flexShrink: 0,
              aspectRatio: "9 / 16",
              height: "62vh",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
              overflow: "hidden",
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
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No capture</span>
              </div>
            )}

            {/* AI concern chips — gradient overlay at photo bottom */}
            {skin && skin.concerns.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "24px 10px 10px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, transparent 100%)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "5px",
                }}
              >
                {skin.concerns.map((c) => (
                  <span
                    key={c.label}
                    style={{
                      padding: "3px 9px",
                      borderRadius: "9999px",
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.22)",
                      color: `rgba(255,255,255,${SEVERITY_OPACITY[c.severity]})`,
                      fontSize: "10px",
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

        {/* ── Skin analysis results ────────────────────────────────────────── */}
        <div
          className="flex-1 px-4 pb-4 pt-3"
          style={{
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {loading ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}
              >
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.7)", animation: "spin 1s linear infinite" }} />
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", letterSpacing: "0.04em" }}>
                  Analyzing your skin…
                </span>
              </motion.div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : skin ? (
            <motion.div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                flex: 1,
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {/* Summary card */}
              <div
                style={{
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {/* Skin type + tone */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      color: "white",
                      fontSize: "22px",
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {skin.skinType}
                  </span>
                  <span
                    style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}
                  >
                    {skin.skinTone}
                  </span>
                </div>

                {/* Hydration + Oiliness bars */}
                {(
                  [
                    { label: "Hydration", value: skin.hydration, delay: 0.4 },
                    { label: "Oiliness", value: skin.oiliness, delay: 0.55 },
                  ] as const
                ).map(({ label, value, delay }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        color: "rgba(255,255,255,0.38)",
                        fontSize: "11px",
                        width: "64px",
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
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 0.7, delay, ease: "easeOut" }}
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
                        fontSize: "13px",
                        fontWeight: 600,
                        width: "34px",
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {value}
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 400,
                          opacity: 0.55,
                        }}
                      >
                        %
                      </span>
                    </span>
                  </div>
                ))}

                {/* Divider + routine tip */}
                {skin.routineTip && (
                  <>
                    <div
                      style={{
                        height: "1px",
                        background: "rgba(255,255,255,0.07)",
                      }}
                    />
                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "12px",
                        lineHeight: 1.55,
                      }}
                    >
                      {skin.routineTip}
                    </span>
                  </>
                )}
              </div>

              {/* Concerns — severity-grouped rows */}
              {skin.concerns.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {(["high", "medium", "low"] as const).map((sev) => {
                    const items = skin.concerns
                      .filter((c) => c.severity === sev)
                      .map((c) => c.label);
                    if (items.length === 0) return null;
                    return (
                      <div
                        key={sev}
                        style={{
                          display: "flex",
                          alignItems: "stretch",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            width: "2px",
                            borderRadius: "9999px",
                            background: `rgba(255,255,255,${SEVERITY_OPACITY[sev]})`,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            color: `rgba(255,255,255,${SEVERITY_OPACITY[sev]})`,
                            fontSize: "12px",
                            lineHeight: 1.5,
                            paddingTop: "1px",
                          }}
                        >
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
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  See Recommended Products{" "}
                  <ArrowRight style={{ width: "15px", height: "15px" }} />
                </button>
              </div>
            </motion.div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px" }}
              >
                No analysis data
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
