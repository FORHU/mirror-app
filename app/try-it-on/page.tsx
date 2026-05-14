"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Download } from "lucide-react";
import { type SlotMap } from "@/modules/garment/types";
import { outfitService } from "@/modules/shared/api/outfit.service";
import { tryOnService, type TryOnRunResult } from "@/modules/shared/api/try-on.service";

type Phase = "building" | "done" | "error";

function getResultImageUrl(result: TryOnRunResult): string | null {
  if (result.output) {
    return Array.isArray(result.output) ? (result.output[0] ?? null) : result.output;
  }
  if (typeof result.imageUrl === "string") return result.imageUrl;
  return null;
}

export default function TryItOnPage() {
  const router     = useRouter();
  const hasStarted = useRef(false);
  const [phase,       setPhase]       = useState<Phase>("building");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [tryOnResult, setTryOnResult] = useState<TryOnRunResult | null>(null);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setPhase("building");
    setErrorMsg("");
    setTryOnResult(null);
    try {
      const raw = localStorage.getItem("mirror_outfit_slots");
      const slotMap: SlotMap = raw ? JSON.parse(raw) : {};

      const hasAny = Object.values(slotMap).some(s => s?.garment);
      if (!hasAny) {
        setErrorMsg("No garments selected. Go back and choose some clothes first.");
        setPhase("error");
        return;
      }

      const items = Object.values(slotMap)
        .filter(s => s?.garment)
        .map(s => ({ garmentId: s!.garment!.id, slot: s!.slot as string }));

      // Step 1: create outfit
      console.log("[try-it-on] Creating outfit with", items.length, "item(s)...");
      let outfit;
      try {
        outfit = await outfitService.create({ name: "My Outfit", items });
        console.log("[try-it-on] Outfit created successfully:", outfit);
      } catch (err) {
        console.error("[try-it-on] Outfit creation failed:", err);
        throw err;
      }

      // Step 2: run try-on
      const kioskId =
        typeof window !== "undefined"
          ? (window.sessionStorage.getItem("kiosk_id") ?? undefined)
          : undefined;
      console.log("[try-it-on] Running try-on — outfitId:", outfit.id, "kioskId:", kioskId ?? "(none)");
      let result;
      try {
        result = await tryOnService.runByOutfit(outfit.id, kioskId);
        console.log("[try-it-on] Try-on result:", result);
      } catch (err) {
        console.error("[try-it-on] Try-on request failed:", err);
        throw err;
      }

      setTryOnResult(result);
      setPhase("done");
    } catch (err: unknown) {
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
        <span className="text-white font-semibold text-lg tracking-wide">Try It On</span>
      </header>

      {/* ── Main content ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 min-h-0">

        {/* Result */}
        {phase === "done" && (
          <div className="flex flex-col items-center gap-6 w-full">
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
                <span className="text-white font-semibold text-xl">Try-on started!</span>
                <span className="text-white/50 text-sm">Your look is being generated</span>
                <pre className="text-white/30 text-xs text-left bg-white/5 rounded-xl p-4 w-full overflow-auto max-h-48">
                  {JSON.stringify(tryOnResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* Loading */}
          {phase === "building" && (
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
                <span className="text-white font-semibold text-xl">Generating your look…</span>
                <span className="text-white/40 text-sm">Creating outfit and running try-on</span>
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
                <span className="text-white font-semibold text-lg">Something went wrong</span>
                <span className="text-white/50 text-sm px-4 leading-relaxed">{errorMsg}</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { hasStarted.current = false; generate(); hasStarted.current = true; }}
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
