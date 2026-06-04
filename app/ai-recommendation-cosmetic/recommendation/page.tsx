"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import "../../../styles/glow.css";
import MirrorHeader from "@/components/MirrorHeader";
import FaceScanGraphic from "@/components/FaceScanGraphic";
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

  const totalPages = Math.ceil(products.length / PAGE_SIZE);
  const pagedProducts = products.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  // Still working (checking for a face, analyzing skin, or fetching recs) and
  // nothing to show yet.
  const busy =
    (faceState === "checking" || analyzing || cwLoading) &&
    products.length === 0;
  const swipe = useSwipe(
    () => setPage((p) => Math.min(p + 1, totalPages - 1)),
    () => setPage((p) => Math.max(p - 1, 0)),
  );

  if (totalPages > 0 && page > totalPages - 1) {
    setPage(totalPages - 1);
  } else if (totalPages === 0 && page !== 0) {
    setPage(0);
  }

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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      {/* Header */}
      <MirrorHeader
        onBack={() => router.push(ROUTES.AI_RECOMMENDATION_COSMETIC)}
      />

      {/* Body */}
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
        {/* Top row: face mesh (left) + verdict (right) */}
        <div
          className="flex shrink-0 px-4 pt-3"
          style={{ gap: "16px", alignItems: "stretch" }}
        >
          {/* Face mesh (left) */}
          <motion.div
            className="shrink-0"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
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
            {/* The captured selfie is used for analysis but never shown — we
                display an abstract analyzed face-mesh graphic instead. */}
            <FaceScanGraphic mode="analyzed" />

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

          {/* Verdict (right) — skin type + hydration/oiliness */}
          <div
            className="flex-1"
            style={{ display: "flex", alignItems: "center", minWidth: 0 }}
          >
            <div
              style={{
                width: "100%",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
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
                    onClick={() => setDetail(product)}
                    style={{
                      borderRadius: "14px",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      minHeight: 0,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      cursor: "pointer",
                    }}
                    initial={{ opacity: 0, scale: 0.96, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    whileTap={{ scale: 0.97 }}
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
                        <div style={{ marginTop: "2px" }}>
                          <span
                            style={{
                              color: "rgba(72,199,142,0.9)",
                              fontSize: "8px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                            }}
                          >
                            Why
                          </span>
                          <span
                            style={{
                              display: "-webkit-box",
                              color: "rgba(255,255,255,0.72)",
                              fontSize: "10px",
                              lineHeight: 1.35,
                              overflow: "hidden",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {product.reason}
                          </span>
                        </div>
                      )}
                      <span
                        style={{
                          marginTop: "auto",
                          color: "rgba(255,255,255,0.4)",
                          fontSize: "9px",
                          fontWeight: 600,
                        }}
                      >
                        Tap for details ›
                      </span>
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
                background: "#0d1013",
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                border: "1px solid rgba(255,255,255,0.10)",
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
                  background: "rgba(255,255,255,0.2)",
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
                    <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 26 }}>◯</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.4)",
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
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
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
                      background: "rgba(72,199,142,0.14)",
                      border: "1px solid rgba(72,199,142,0.4)",
                    }}
                  >
                    <span style={{ color: "rgba(72,199,142,0.95)", fontSize: 12, fontWeight: 700 }}>
                      {detail.score}% match
                    </span>
                  </div>
                </div>
              </div>

              {/* Why recommended */}
              {detail.reason && (
                <div
                  style={{
                    background: "rgba(72,199,142,0.07)",
                    border: "1px solid rgba(72,199,142,0.22)",
                    borderRadius: 14,
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      color: "rgba(72,199,142,0.95)",
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
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.5 }}>
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
                  border: "1px solid rgba(255,255,255,0.14)",
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
