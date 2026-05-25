"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Download } from "lucide-react";
import { type SlotMap } from "@/modules/garment/types";
import { outfitService } from "@/modules/shared/api/outfit.service";
import {
  tryOnService,
  type TryOnRunResult,
} from "@/modules/shared/api/try-on.service";
import { getSocketClient } from "@/modules/shared/socket/socket-client";

type Phase = "building" | "waiting" | "done" | "error";

interface TryOnCompletedPayload {
  predictionId: string;
  fileId?: string;
  media?: "image" | "video";
  imageUrl?: string;
  videoUrl?: string;
}

interface TryOnFailedPayload {
  predictionId?: string;
  error?: string;
}

function getResultImageUrl(result: TryOnRunResult): string | null {
  if (typeof result.imageUrl === "string") return result.imageUrl;
  if (result.output) {
    return Array.isArray(result.output)
      ? (result.output[0] ?? null)
      : result.output;
  }
  return null;
}

export default function TryItOnPage() {
  const router = useRouter();
  const hasStarted = useRef(false);
  const [phase, setPhase] = useState<Phase>("building");
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [tryOnResult, setTryOnResult] = useState<TryOnRunResult | null>(null);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    generate();
  }, []);

  // Subscribe to FASHN completion events once we know the predictionId.
  // The kickoff REST call returns immediately (202 Accepted) — the actual
  // image arrives later via the kiosk's socket room as `tryon_completed`.
  useEffect(() => {
    if (!predictionId) return;
    const socket = getSocketClient();

    const onCompleted = (payload: TryOnCompletedPayload) => {
      if (payload.predictionId !== predictionId) return;
      console.log("[try-it-on] tryon_completed", payload);
      setTryOnResult({
        predictionId: payload.predictionId,
        fileId: payload.fileId,
        media: payload.media,
        imageUrl: payload.imageUrl,
        output: payload.imageUrl ?? payload.videoUrl,
      });
      setPhase("done");
    };

    const onFailed = (payload: TryOnFailedPayload) => {
      if (payload.predictionId && payload.predictionId !== predictionId) return;
      console.error("[try-it-on] tryon_failed", payload);
      setErrorMsg(payload.error || "Try-on failed");
      setPhase("error");
    };

    socket.on("tryon_completed", onCompleted);
    socket.on("tryon_failed", onFailed);
    return () => {
      socket.off("tryon_completed", onCompleted);
      socket.off("tryon_failed", onFailed);
    };
  }, [predictionId]);

  async function generate() {
    setPhase("building");
    setPredictionId(null);
    setErrorMsg("");
    setTryOnResult(null);
    try {
      const raw = sessionStorage.getItem("mirror_outfit_slots");
      const slotMap: SlotMap = raw ? JSON.parse(raw) : {};

      const hasAny = Object.values(slotMap).some((s) => s?.garment);
      if (!hasAny) {
        setErrorMsg(
          "No garments selected. Go back and choose some clothes first.",
        );
        setPhase("error");
        return;
      }

      const items = Object.values(slotMap)
        .filter((s) => s?.garment)
        .map((s) => ({ garmentId: s!.garment!.id, slot: s!.slot as string }));

      // Step 1: create outfit
      console.log(
        "[try-it-on] Creating outfit with",
        items.length,
        "item(s)...",
      );
      let outfit;
      try {
        outfit = await outfitService.create({ name: "My Outfit", items });
        console.log("[try-it-on] Outfit created successfully:", outfit);
      } catch (err) {
        console.error("[try-it-on] Outfit creation failed:", err);
        throw err;
      }

      // Step 2: kick off try-on (202 Accepted — result arrives via socket)
      const kioskId =
        typeof window !== "undefined"
          ? (window.sessionStorage.getItem("kiosk_id") ?? undefined)
          : undefined;
      console.log(
        "[try-it-on] Starting try-on — outfitId:",
        outfit.id,
        "kioskId:",
        kioskId ?? "(none)",
      );
      let kickoff;
      try {
        kickoff = await tryOnService.runByOutfit(outfit.id, kioskId);
        console.log("[try-it-on] Try-on kicked off:", kickoff);
      } catch (err) {
        console.error("[try-it-on] Try-on request failed:", err);
        throw err;
      }

      // Track predictionId so the socket listener can match the response
      const pid = kickoff.id ?? kickoff.predictionId;
      if (pid) setPredictionId(pid);

      // Stay in "building" — the image will arrive via tryon_completed socket event
    } catch (err: unknown) {
      console.error("[try-it-on] Failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
      setPhase("error");
    }
  }

  function handleDownload() {
    const imageUrl = tryOnResult ? getResultImageUrl(tryOnResult) : null;
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = "try-on.jpg";
    a.target = "_blank";
    a.click();
  }

  const resultImageUrl = tryOnResult ? getResultImageUrl(tryOnResult) : null;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      {/* ── Background gradient ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1030] via-[#0d0820] to-[#1a1030]" />

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center gap-4 px-6 pt-10 pb-4 flex-none">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </motion.button>
        <span className="text-white font-semibold text-lg tracking-wide">
          Try It On
        </span>
      </header>

      {/* ── Main content ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 min-h-0">
        <AnimatePresence mode="wait">
          {/* Result */}
          {phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 w-full"
            >
              {resultImageUrl ? (
                <>
                  <div
                    className="relative w-full rounded-3xl overflow-hidden shadow-[0_8px_64px_rgba(168,85,247,0.25)] border border-white/10"
                    style={{ maxHeight: "65vh", aspectRatio: "2/3" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resultImageUrl}
                      alt="Try-on result"
                      className="w-full h-full object-contain"
                      style={{ background: "#fbfcff" }}
                    />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDownload}
                    className="w-full py-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur text-white font-semibold text-base flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Save
                  </motion.button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center w-full">
                  <div className="w-20 h-20 rounded-full bg-purple-500/15 border border-purple-400/30 flex items-center justify-center">
                    <span className="text-3xl">✨</span>
                  </div>
                  <span className="text-white font-semibold text-xl">
                    Try-on started!
                  </span>
                  <span className="text-white/50 text-sm">
                    Your look is being generated
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {/* Loading */}
          {(phase === "building" || phase === "waiting") && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-8 w-full"
            >
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-400 border-r-pink-400 animate-spin" />
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/10">
                  <span className="text-2xl">✨</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-white font-semibold text-xl">
                  Generating your look…
                </span>
                <span className="text-white/40 text-sm">
                  Creating outfit and running try-on
                </span>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 text-center w-full"
            >
              <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-400/30 flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-white font-semibold text-lg">
                  Something went wrong
                </span>
                <span className="text-white/50 text-sm px-4 leading-relaxed">
                  {errorMsg}
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => generate()}
                className="px-10 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-base"
              >
                Try Again
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
