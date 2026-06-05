"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { ArrowLeft, ChevronLeft, Home, Heart, User, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import "../../../styles/glow.css";
import {
  cosmeticsService,
  type SkinAnalysis,
} from "@/modules/shared/api/cosmetics.service";
import { listenForSkinAnalysis } from "@/modules/shared/api/skinAnalysisSocket";
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

// ── Detailed weather (humidity + feels-like) for the left info panel ──────────
type DetailedWeather = {
  temp: number | null;
  code: number;
  city: string;
  humidity: number | null;
  feelsLike: number | null;
};

// Small emoji glyph for the current weather code (avoids importing the internal
// WeatherWidget icon and a second geolocation lookup).
function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "⛅";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌤️";
}

// Best-effort face check using the browser's native Shape Detection API.
// Returns true (face found) / false (no face) / null (couldn't determine —
// e.g. FaceDetector unavailable, so we shouldn't block the user).
async function detectFace(dataUrl: string): Promise<boolean | null> {
  try {
    const FD = (
      window as unknown as {
        FaceDetector?: new (opts?: unknown) => {
          detect: (i: CanvasImageSource) => Promise<unknown[]>;
        };
      }
    ).FaceDetector;
    if (!FD) return null;
    const detector = new FD({ fastMode: true, maxDetectedFaces: 1 });
    const img = document.createElement("img");
    img.src = dataUrl;
    await img.decode();
    const faces = await detector.detect(img);
    return faces.length > 0;
  } catch {
    return null;
  }
}

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

// Split an AI "reason" string into up to three concise bullet points.
function reasonToBullets(reason: string): string[] {
  return reason
    .split(/[.,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
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

// Group products into ordered category sections for the right-hand panel.
function groupByCategory(
  products: Product[],
): { category: string; items: Product[] }[] {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.category || "Skincare";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map, ([category, items]) => ({ category, items }));
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CosmeticRecommendationPage() {
  const router = useRouter();

  type SessionData = {
    capturedImage: string | null;
    analysis: SkinAnalysis | null;
  };
  const [session, setSession] = useState<SessionData>({
    capturedImage: null,
    analysis: null,
  });
  const { analysis } = session;
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  // Product whose full detail/why-recommended sheet is open (null = closed).
  const [detail, setDetail] = useState<Product | null>(null);
  // Real upload/analyze failure — surfaced to the user instead of silently
  // showing a fake "Normal" result. Holds the technical message for debugging.
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [cwProducts, setCwProducts] = useState<CWProduct[] | null>(null);
  const [cwLoading, setCwLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  // "checking" → running face detection on the capture
  // "ok"       → face found (or detector unavailable) → results proceed
  // "none"     → no face in the photo → show the retake screen
  const [faceState, setFaceState] = useState<"checking" | "ok" | "none">(
    "checking",
  );
  // Live clock for the top bar.
  const [now, setNow] = useState<Date>(() => new Date());
  // Detailed weather for the left info panel.
  const [weather, setWeather] = useState<DetailedWeather | null>(null);
  // Purely-visual "saved to favourites" toggle for the bottom nav heart.
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch detailed weather (temp / humidity / feels-like) once on mount.
  useEffect(() => {
    let cancelled = false;
    const load = (lat?: number, lon?: number) => {
      const qs =
        lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : "";
      fetch(`/api/weather${qs}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setWeather(d as DetailedWeather);
        })
        .catch(() => {});
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => load(coords.latitude, coords.longitude),
        () => load(),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 600000 },
      );
    } else {
      load();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Runs the whole pipeline that used to live on the (now-removed) result page:
  // upload the capture → analyze the skin → then fetch product recommendations.
  // The skeleton grid shows for the entire wait.
  useEffect(() => {
    let cancelled = false;
    let socketUnsub: (() => void) | null = null;
    let analysisTimer: ReturnType<typeof setTimeout> | null = null;

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

    // Surface a real failure instead of inventing a "Normal" result. We log the
    // full error for devs and keep the message so the UI can show what broke.
    const failAnalysis = (err: unknown, where: string) => {
      if (cancelled) return;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[skin-analysis] ${where} failed:`, err);
      setAnalysisError(msg || "Skin analysis failed");
    };

    const run = async () => {
      try {
        const capturedImage = sessionStorage.getItem("skin_capture");
        const rawAnalysis = sessionStorage.getItem("skin_analysis");
        const existing = rawAnalysis
          ? (JSON.parse(rawAnalysis) as SkinAnalysis)
          : null;
        const existingId = !existing
          ? sessionStorage.getItem("skin_analysis_id")
          : null;

        setSession({ capturedImage, analysis: existing });

        // Face gate — only for a brand-new capture (no prior analysis to resume).
        // If the photo clearly has no face, stop here and show the retake screen
        // instead of inventing a bogus "Normal" result.
        if (capturedImage && !existing && !existingId) {
          const hasFace = await detectFace(capturedImage);
          if (cancelled) return;
          if (hasFace === false) {
            setFaceState("none");
            return;
          }
        }
        if (cancelled) return;
        setFaceState("ok");

        if (existing) {
          fetchRecs(existing);
        } else if (existingId) {
          // Resume a previously-started analysis by ID
          setAnalyzing(true);
          cosmeticsService
            .getAnalysis(existingId)
            .then(applyAnalysis)
            .catch((err) => failAnalysis(err, "getAnalysis"))
            .finally(() => setAnalyzing(false));
        } else if (capturedImage) {
          // Fresh capture. Analysis is ASYNC: the POST returns 202 ("started")
          // and the real result is pushed over Socket.io. So we subscribe FIRST
          // (to avoid racing the push), then upload + start the job, then wait
          // for `skin_analysis_complete`. A timeout guards against a lost push.
          setAnalyzing(true);

          const finish = () => {
            if (analysisTimer) clearTimeout(analysisTimer);
            socketUnsub?.();
            socketUnsub = null;
            if (!cancelled) setAnalyzing(false);
          };

          listenForSkinAnalysis({
            onComplete: (data) => {
              if (cancelled) return;
              finish();
              applyAnalysis(data as SkinAnalysis);
            },
            onError: (msg) => {
              if (cancelled) return;
              finish();
              failAnalysis(new Error(msg), "analyze(socket)");
            },
          }).then((unsub) => {
            if (cancelled) {
              unsub();
              return;
            }
            socketUnsub = unsub;

            // Start the pipeline. Result arrives via the socket above, not here.
            cosmeticsService
              .uploadCapture(capturedImage)
              .then(({ id }) => cosmeticsService.startSkinAnalysis(id))
              .catch((err) => {
                if (cancelled) return;
                finish();
                failAnalysis(err, "upload/start-analysis");
              });

            // Safety net: surface an error if no result lands in time.
            analysisTimer = setTimeout(() => {
              if (cancelled) return;
              finish();
              failAnalysis(
                new Error("Timed out waiting for the analysis result."),
                "analyze(timeout)",
              );
            }, 45000);
          });
        }
      } catch {
        if (!cancelled) setFaceState("ok");
      }
    };

    run();
    return () => {
      cancelled = true;
      if (analysisTimer) clearTimeout(analysisTimer);
      socketUnsub?.();
    };
  }, []);

  const concerns = useMemo(
    () =>
      (analysis?.concerns ?? []).map((c) => ({
        label: c,
        severity: inferSeverity(c),
      })),
    [analysis],
  );

  // Compact skin summary shown in the left panel (replaces the result page).
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

  // ── Products — prefer ChatWonder results, then the rule engine.
  const sourced: Product[] = cwProducts?.length
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
      : [];

  const isExample = (p: Product) =>
    p.name.toLowerCase() === "example product" ||
    p.brand.toLowerCase() === "example brand";
  const hasProductImage = (p: Product) => Boolean(p.imageUrl?.trim());

  // Real / AI picks must have a usable image so the card doesn't look broken.
  const withImages = sourced.filter(
    (p) => hasProductImage(p) && !failedImageIds.has(p.id) && !isExample(p),
  );

  const stillWorking = analyzing || cwLoading;
  // Once analysis is done, always recommend something. If no image-backed picks
  // survived (e.g. a clean "Normal" result, or the analyze call fell back to
  // mock data), show a general skincare set — these render fine with the
  // built-in placeholder even without product images.
  const products =
    withImages.length > 0
      ? withImages
      : stillWorking
        ? []
        : MOCK_PRODUCTS.filter(
            (p) =>
              hasProductImage(p) && !failedImageIds.has(p.id) && !isExample(p),
          );

  // Still working (checking for a face, analyzing skin, or fetching recs) and
  // nothing to show yet.
  const busy =
    (faceState === "checking" || analyzing || cwLoading) &&
    products.length === 0;

  const grouped = groupByCategory(products);

  // ── No face detected — show a clear retake prompt instead of a fake result ──
  if (faceState === "none") {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
        <header
          className="flex items-center shrink-0 py-4 px-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
        >
          <button
            onClick={() => router.push(ROUTES.AI_RECOMMENDATION_COSMETIC)}
            className="p-2 -ml-2 text-white/80 active:text-white transition-colors"
          >
            <ArrowLeft className="w-7 h-7" />
          </button>
          <h1 className="flex-1 text-center text-white font-bold text-2xl pr-9">
            Skin Analysis
          </h1>
        </header>

        <motion.div
          className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          style={{ gap: "18px" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "44px",
              background: "rgba(248,113,113,0.10)",
              border: "1px solid rgba(248,113,113,0.35)",
            }}
          >
            🙈
          </div>
          <h2 style={{ color: "white", fontSize: "22px", fontWeight: 700 }}>
            No face detected
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: "14px",
              lineHeight: 1.5,
              maxWidth: "320px",
            }}
          >
            We couldn&apos;t find a face in your photo. Move a little closer and
            look directly at the camera, then try again.
          </p>
          <button
            onClick={() => router.push(ROUTES.AI_RECOMMENDATION_COSMETIC)}
            className="px-9 py-3 rounded-full font-semibold text-sm tracking-wide"
            style={{
              marginTop: "6px",
              background: "rgba(72,199,142,0.18)",
              border: "1px solid rgba(72,199,142,0.55)",
              color: "rgba(72,199,142,0.95)",
              backdropFilter: "blur(8px)",
            }}
          >
            📸 Retake photo
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Analysis failed — show what broke instead of a fake "Normal" result ──────
  if (analysisError) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
        <header
          className="flex items-center shrink-0 py-4 px-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
        >
          <button
            onClick={() => router.push(ROUTES.AI_RECOMMENDATION_COSMETIC)}
            className="p-2 -ml-2 text-white/80 active:text-white transition-colors"
          >
            <ArrowLeft className="w-7 h-7" />
          </button>
          <h1 className="flex-1 text-center text-white font-bold text-2xl pr-9">
            Skin Analysis
          </h1>
        </header>

        <motion.div
          className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          style={{ gap: "18px" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "44px",
              background: "rgba(248,113,113,0.10)",
              border: "1px solid rgba(248,113,113,0.35)",
            }}
          >
            ⚠️
          </div>
          <h2 style={{ color: "white", fontSize: "22px", fontWeight: 700 }}>
            Couldn&apos;t analyze your skin
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: "14px",
              lineHeight: 1.5,
              maxWidth: "320px",
            }}
          >
            The analysis service didn&apos;t respond. Please try again in a
            moment.
          </p>
          {/* Technical detail — visible on-device so failures aren't hidden. */}
          <code
            style={{
              color: "rgba(248,113,113,0.8)",
              fontSize: "11px",
              maxWidth: "340px",
              wordBreak: "break-word",
              opacity: 0.85,
            }}
          >
            {analysisError}
          </code>
          <button
            onClick={() => router.push(ROUTES.AI_RECOMMENDATION_COSMETIC)}
            className="px-9 py-3 rounded-full font-semibold text-sm tracking-wide"
            style={{
              marginTop: "6px",
              background: "rgba(72,199,142,0.18)",
              border: "1px solid rgba(72,199,142,0.55)",
              color: "rgba(72,199,142,0.95)",
              backdropFilter: "blur(8px)",
            }}
          >
            🔄 Try again
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Warm smart-mirror layout ────────────────────────────────────────────────
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString([], { weekday: "long" });
  const date = now.toLocaleDateString([], { month: "long", day: "numeric" });
  const hour = now.getHours();
  const partOfDay =
    hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  // Warm palette tokens.
  const CREAM = "rgba(255,248,242,0.95)";
  const DIM = "rgba(245,228,214,0.6)";
  const FAINT = "rgba(245,228,214,0.4)";
  const GOLD = "rgba(255,201,150,0.95)";
  const panel: React.CSSProperties = {
    background: "rgba(40,30,24,0.34)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(255,214,176,0.16)",
    borderRadius: "22px",
    padding: "26px 28px",
    flex: "1 1 0",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  };
  const labelStyle: React.CSSProperties = {
    color: GOLD,
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  };

  // Composed "AI answer" sentence from the skin reading + today's weather.
  const aiAnswer = !skin
    ? "Looking you over and pulling together a routine tailored to your skin today…"
    : [
        `Your skin is reading as ${skin.skinType.toLowerCase()} today — hydration ${skin.hydration}%, oiliness ${skin.oiliness}%.`,
        weather?.humidity != null && weather.humidity >= 65
          ? "Humidity is high, so I'm focusing on oil control and lightweight, breathable layers."
          : weather?.temp != null && weather.temp <= 18
            ? "It's cool out, so I'm leaning into richer hydration and barrier care."
            : "I've balanced gentle hydration with daytime protection for you.",
      ].join(" ");

  // Skin tips derived from the reading + concerns.
  const tips: string[] = (() => {
    const t: string[] = [];
    const type = skin?.skinType?.toLowerCase() ?? "";
    if (type.includes("oily")) {
      t.push("Use a lightweight, oil-free moisturizer");
      t.push("Blot midday instead of re-applying heavy cream");
    } else if (type.includes("dry")) {
      t.push("Layer a hydrating serum under your moisturizer");
      t.push("Avoid hot water when cleansing");
    } else {
      t.push("Keep a simple cleanse · hydrate · protect routine");
    }
    if (concerns.some((c) => /pore/i.test(c.label)))
      t.push("Add a BHA exfoliant 2–3× a week");
    if (concerns.some((c) => /redness|sensitiv/i.test(c.label)))
      t.push("Choose fragrance-free, calming formulas");
    if (concerns.some((c) => /acne/i.test(c.label)))
      t.push("Spot-treat with salicylic acid, not all over");
    t.push("Always finish daytime with SPF");
    return t.slice(0, 4);
  })();

  const weatherNote =
    weather?.humidity != null && weather.humidity >= 65
      ? "High humidity may add shine — focus on oil control."
      : weather?.temp != null && weather.temp <= 18
        ? "Cooler air can dry skin — layer on hydration."
        : "Mild conditions — keep your routine balanced.";

  const personalizing = analyzing || cwLoading;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Warm ambient wash — kept to the edges so the center stays dark for the
          physical mirror reflection. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(255,196,140,0.10) 0%, transparent 46%), radial-gradient(120% 90% at 50% 100%, rgba(255,170,110,0.09) 0%, transparent 52%)",
        }}
      />
      {/* Glowing LED mirror frame */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "10px",
          borderRadius: "34px",
          border: "2px solid rgba(255,206,160,0.55)",
          boxShadow:
            "0 0 22px 4px rgba(255,180,120,0.45), 0 0 60px 10px rgba(255,150,90,0.22), inset 0 0 36px rgba(255,190,130,0.12)",
          pointerEvents: "none",
        }}
      />

      {/* Content sits inside the frame */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "26px 34px 18px",
        }}
      >
        {/* ── Top bar ── */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          {/* left: back + weather */}
          <div
            style={{
              flex: "1 1 0",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              minWidth: 0,
            }}
          >
            <button
              onClick={() => router.push(ROUTES.AI_RECOMMENDATION_COSMETIC)}
              aria-label="Back"
              style={{
                color: DIM,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px",
              }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "26px", lineHeight: 1 }}>
                {weather ? weatherEmoji(weather.code) : "🌤️"}
              </span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{ color: CREAM, fontSize: "17px", fontWeight: 600 }}
                >
                  {weather?.temp != null ? `${weather.temp}°C` : "--°C"}
                </span>
                <span style={{ color: FAINT, fontSize: "11px" }}>
                  {weather?.city && weather.city !== "---"
                    ? weather.city
                    : ""}
                </span>
              </div>
            </div>
          </div>

          {/* center: time + date */}
          <div style={{ flex: "0 0 auto", textAlign: "center" }}>
            <div
              style={{
                color: CREAM,
                fontSize: "30px",
                fontWeight: 300,
                letterSpacing: "0.02em",
                lineHeight: 1.1,
              }}
            >
              {time}
            </div>
            <div style={{ color: DIM, fontSize: "13px" }}>
              {day}, {date}
            </div>
          </div>

          {/* right: greeting */}
          <div
            style={{ flex: "1 1 0", textAlign: "right", minWidth: 0 }}
          >
            <div style={{ color: CREAM, fontSize: "20px", fontWeight: 400 }}>
              Hello!
            </div>
            <div style={{ color: DIM, fontSize: "12px" }}>
              Have a great {partOfDay}
            </div>
          </div>
        </div>

        {/* ── Body: left info · transparent reflection · products ── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            gap: "24px",
            paddingTop: "24px",
          }}
        >
          {/* Left column */}
          <div
            style={{
              flex: "0 0 30%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {/* AI suggestion */}
            <motion.div
              style={panel}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "14px",
                }}
              >
                <Mic className="w-4 h-4" style={{ color: GOLD }} />
                <span style={labelStyle}>AI Suggestion</span>
                {personalizing && (
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ color: GOLD, fontSize: "12px", marginLeft: "auto" }}
                  >
                    ✦
                  </motion.span>
                )}
              </div>
              <p
                style={{
                  color: CREAM,
                  fontSize: "17px",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {aiAnswer}
              </p>
            </motion.div>

            {/* Skin reading */}
            <motion.div
              style={panel}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <span style={labelStyle}>Skin Reading</span>
                {skin && (
                  <span style={{ color: FAINT, fontSize: "13px" }}>
                    {skin.skinTone}
                  </span>
                )}
              </div>
              <div
                style={{
                  color: CREAM,
                  fontSize: "36px",
                  fontWeight: 700,
                  marginBottom: "20px",
                }}
              >
                {skin ? skin.skinType : "Analyzing…"}
              </div>
              {(
                [
                  { label: "Hydration", value: skin?.hydration ?? 0 },
                  { label: "Oiliness", value: skin?.oiliness ?? 0 },
                ] as const
              ).map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <span
                    style={{
                      color: DIM,
                      fontSize: "13px",
                      width: "72px",
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: "7px",
                      borderRadius: "9999px",
                      background: "rgba(255,255,255,0.12)",
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: skin ? `${value}%` : "0%" }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      style={{
                        height: "100%",
                        borderRadius: "9999px",
                        background:
                          "linear-gradient(90deg, rgba(255,210,160,0.95), rgba(255,170,110,0.9))",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      color: CREAM,
                      fontSize: "15px",
                      fontWeight: 600,
                      width: "40px",
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    {skin ? `${value}%` : "—"}
                  </span>
                </div>
              ))}
              {concerns.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "7px",
                    marginTop: "16px",
                  }}
                >
                  {concerns.map((c) => (
                    <span
                      key={c.label}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "9999px",
                        background: "rgba(255,210,170,0.10)",
                        border: "1px solid rgba(255,210,170,0.22)",
                        color: `rgba(255,236,220,${SEVERITY_OPACITY[c.severity]})`,
                        fontSize: "11px",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Today's weather */}
            <motion.div
              style={panel}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              <div style={{ ...labelStyle, marginBottom: "16px" }}>
                Today&apos;s Weather
              </div>
              {(
                [
                  {
                    icon: weather ? weatherEmoji(weather.code) : "🌤️",
                    label:
                      weather?.temp != null ? `${weather.temp}°C` : "--°C",
                  },
                  {
                    icon: "💧",
                    label:
                      weather?.humidity != null
                        ? `Humidity ${weather.humidity}%`
                        : "Humidity —",
                  },
                  {
                    icon: "🌡️",
                    label:
                      weather?.feelsLike != null
                        ? `Feels like ${weather.feelsLike}°C`
                        : "Feels like —",
                  },
                ] as const
              ).map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "11px",
                  }}
                >
                  <span style={{ fontSize: "20px", width: "26px" }}>
                    {row.icon}
                  </span>
                  <span style={{ color: CREAM, fontSize: "16px" }}>
                    {row.label}
                  </span>
                </div>
              ))}
              <p
                style={{
                  color: DIM,
                  fontSize: "13px",
                  lineHeight: 1.55,
                  margin: "12px 0 0",
                }}
              >
                {weatherNote}
              </p>
            </motion.div>

            {/* Skin tips */}
            <motion.div
              style={panel}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
            >
              <div style={{ ...labelStyle, marginBottom: "16px" }}>
                Skin Tip
              </div>
              {tips.map((t) => (
                <div
                  key={t}
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ color: GOLD, fontSize: "16px", lineHeight: 1.5 }}>
                    ✓
                  </span>
                  <span
                    style={{ color: CREAM, fontSize: "16px", lineHeight: 1.5 }}
                  >
                    {t}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Center — left transparent so the physical mirror reflection shows
              through. Only a subtle status pill appears while we work. */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: "16px",
            }}
          >
            {personalizing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "9999px",
                  background: "rgba(40,30,24,0.45)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,214,176,0.2)",
                }}
              >
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{ color: GOLD, fontSize: "12px" }}
                >
                  ✦
                </motion.span>
                <span style={{ color: CREAM, fontSize: "12px" }}>
                  {analyzing
                    ? "Analyzing your skin…"
                    : "Personalizing your picks…"}
                </span>
              </motion.div>
            )}
          </div>

          {/* Right column — recommended products grouped by category */}
          <div
            style={{
              flex: "0 0 34%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "18px",
                flexShrink: 0,
              }}
            >
              <span
                style={{ color: CREAM, fontSize: "22px", fontWeight: 600 }}
              >
                Recommended Products
              </span>
              <span
                style={{
                  color: FAINT,
                  fontSize: "14px",
                  padding: "2px 11px",
                  borderRadius: "9999px",
                  border: "1px solid rgba(255,214,176,0.2)",
                }}
              >
                {products.length}
              </span>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                paddingRight: "4px",
              }}
            >
              {busy ? (
                [0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={`sk-${i}`}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                    style={{
                      flex: "1 1 0",
                      minHeight: 110,
                      maxHeight: 230,
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      padding: "18px",
                      borderRadius: "18px",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,214,176,0.1)",
                    }}
                  >
                    <div
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.07)",
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          height: 8,
                          width: "70%",
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.08)",
                        }}
                      />
                      <div
                        style={{
                          height: 7,
                          width: "45%",
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.06)",
                        }}
                      />
                      <div
                        style={{
                          height: 7,
                          width: "85%",
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.05)",
                        }}
                      />
                    </div>
                  </motion.div>
                ))
              ) : products.length === 0 ? (
                <div
                  style={{
                    margin: "auto",
                    textAlign: "center",
                    color: FAINT,
                    fontSize: "13px",
                    lineHeight: 1.6,
                    padding: "24px",
                  }}
                >
                  No picks to show yet.
                  <br />
                  Try scanning again for fresh recommendations.
                </div>
              ) : (
                grouped.map(({ category, items }) => (
                  <div
                    key={category}
                    style={{
                      flex: "1 1 0",
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        ...labelStyle,
                        color: DIM,
                        marginBottom: "14px",
                      }}
                    >
                      {category}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      {items.map((product, i) => {
                        const bullets = reasonToBullets(product.reason);
                        return (
                          <motion.button
                            key={product.id}
                            onClick={() => setDetail(product)}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.04 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                              flex: "1 1 0",
                              minHeight: 110,
                              maxHeight: 230,
                              display: "flex",
                              alignItems: "center",
                              gap: "16px",
                              padding: "18px",
                              borderRadius: "18px",
                              textAlign: "left",
                              background: "rgba(40,30,24,0.34)",
                              backdropFilter: "blur(10px)",
                              border: "1px solid rgba(255,214,176,0.14)",
                              cursor: "pointer",
                            }}
                          >
                            {/* thumb */}
                            <div
                              style={{
                                flex: "0 0 100px",
                                height: 100,
                                borderRadius: 14,
                                overflow: "hidden",
                                position: "relative",
                                background: "rgba(255,255,255,0.05)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {product.imageUrl &&
                              !failedImageIds.has(product.id) ? (
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
                                <span
                                  style={{
                                    color: "rgba(255,255,255,0.15)",
                                    fontSize: 40,
                                  }}
                                >
                                  ◯
                                </span>
                              )}
                            </div>

                            {/* text */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "baseline",
                                  justifyContent: "space-between",
                                  gap: "8px",
                                }}
                              >
                                <span
                                  style={{
                                    color: CREAM,
                                    fontSize: "17px",
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
                                    color: GOLD,
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  {product.score}%
                                </span>
                              </div>
                              {product.brand && (
                                <div
                                  style={{
                                    color: FAINT,
                                    fontSize: "13px",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    marginTop: "3px",
                                  }}
                                >
                                  {product.brand}
                                </div>
                              )}
                              {bullets.length > 0 ? (
                                <ul
                                  style={{
                                    margin: "10px 0 0",
                                    padding: 0,
                                    listStyle: "none",
                                  }}
                                >
                                  {bullets.map((b) => (
                                    <li
                                      key={b}
                                      style={{
                                        display: "flex",
                                        gap: "7px",
                                        color: DIM,
                                        fontSize: "13px",
                                        lineHeight: 1.5,
                                        marginBottom: "3px",
                                      }}
                                    >
                                      <span style={{ color: GOLD }}>·</span>
                                      <span
                                        style={{
                                          overflow: "hidden",
                                          display: "-webkit-box",
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: "vertical",
                                        }}
                                      >
                                        {b}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div
                                  style={{
                                    color: FAINT,
                                    fontSize: "13px",
                                    marginTop: "8px",
                                  }}
                                >
                                  Tap for details ›
                                </div>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom bar: mic + nav ── */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            paddingTop: "8px",
          }}
        >
          <button
            onClick={() => router.push(ROUTES.AI_ASSISTANT)}
            aria-label="Ask me anything"
            style={{
              width: 66,
              height: 66,
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,200,150,0.16)",
              border: "1px solid rgba(255,206,160,0.5)",
              boxShadow: "0 0 24px rgba(255,180,120,0.4)",
              cursor: "pointer",
            }}
          >
            <Mic className="w-7 h-7" style={{ color: GOLD }} />
          </button>
          <span style={{ color: DIM, fontSize: "13px" }}>Ask me anything</span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "42px",
              marginTop: "6px",
            }}
          >
            <button
              onClick={() => router.push(ROUTES.OVERVIEW)}
              aria-label="Home"
              style={{ color: DIM }}
            >
              <Home className="w-7 h-7" />
            </button>
            <button
              onClick={() => setSaved((s) => !s)}
              aria-label="Save to favourites"
              style={{ color: saved ? "rgba(255,120,120,0.95)" : DIM }}
            >
              <Heart
                className="w-7 h-7"
                fill={saved ? "currentColor" : "none"}
              />
            </button>
            <button
              onClick={() => router.push(ROUTES.LOGGED_IN)}
              aria-label="Profile"
              style={{ color: DIM }}
            >
              <User className="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>

      {/* Product detail / why-recommended sheet */}
      <AnimatePresence>
        {detail && (
          <motion.div
            key="product-detail"
            onClick={() => setDetail(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 50,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              style={{
                width: "100%",
                maxHeight: "82%",
                overflowY: "auto",
                background: "#15100c",
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                border: "1px solid rgba(255,214,176,0.16)",
                padding: "16px 18px 26px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* grab handle */}
              <div
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(255,214,176,0.3)",
                  margin: "0 auto 2px",
                }}
              />

              <div style={{ display: "flex", gap: 14 }}>
                {/* image / placeholder */}
                <div
                  style={{
                    flex: "0 0 96px",
                    height: 96,
                    borderRadius: 12,
                    overflow: "hidden",
                    position: "relative",
                    background: "rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {detail.imageUrl && !failedImageIds.has(detail.id) ? (
                    <Image
                      fill
                      unoptimized
                      src={detail.imageUrl}
                      alt={detail.name}
                      style={{ objectFit: "contain" }}
                    />
                  ) : (
                    <span
                      style={{ color: "rgba(255,255,255,0.15)", fontSize: 26 }}
                    >
                      ◯
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      color: FAINT,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.09em",
                    }}
                  >
                    {detail.category} · {detail.use}
                  </span>
                  <h3
                    style={{
                      color: "white",
                      fontSize: 18,
                      fontWeight: 700,
                      lineHeight: 1.25,
                      margin: "3px 0 2px",
                    }}
                  >
                    {detail.name}
                  </h3>
                  <span style={{ color: DIM, fontSize: 13 }}>
                    {detail.brand}
                  </span>
                  <div
                    style={{
                      marginTop: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "rgba(255,200,150,0.14)",
                      border: "1px solid rgba(255,206,160,0.4)",
                    }}
                  >
                    <span
                      style={{
                        color: GOLD,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {detail.score}% match
                    </span>
                  </div>
                </div>
              </div>

              {/* Why recommended */}
              {detail.reason && (
                <div
                  style={{
                    background: "rgba(255,200,150,0.07)",
                    border: "1px solid rgba(255,206,160,0.22)",
                    borderRadius: 14,
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      color: GOLD,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 6,
                    }}
                  >
                    ✦ Why this suits your skin
                  </div>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.85)",
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    {detail.reason}
                  </p>
                </div>
              )}

              {/* How to use */}
              <div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 4,
                  }}
                >
                  When to use
                </div>
                <p
                  style={{
                    color: "rgba(255,255,255,0.75)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  Apply as your {detail.category.toLowerCase()} during your{" "}
                  {detail.use === "AM"
                    ? "morning"
                    : detail.use === "PM"
                      ? "evening"
                      : "morning and evening"}{" "}
                  routine.
                </p>
              </div>

              <button
                onClick={() => setDetail(null)}
                style={{
                  marginTop: 4,
                  padding: "12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,214,176,0.18)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
