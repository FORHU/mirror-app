"use client";

import { useEffect, useRef, useState } from "react";
import { useCaptureFrame } from "@/components/ProximitySensorMount";
import { cosmeticsService } from "@/modules/shared/api/cosmetics.service";
import { listenForSkinAnalysis } from "@/modules/shared/api/skinAnalysisSocket";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import type { SkinAnalysis } from "@/modules/shared/api/cosmetics.service";

export type SkinAnalysisState =
  | "idle"
  | "uploading"
  | "analyzing"
  | "done"
  | "error";

/**
 * Triggers skin analysis using the frame already captured by the
 * proximity sensor — no second camera stream needed.
 *
 * Fires once per session when isPresent becomes true. Skips if a
 * result already exists in the store.
 */
export function useSkinAnalysisCapture() {
  const existingResult = useMirrorStore((s) => s.skinAnalysisResult);
  const isPresent = useMirrorStore((s) => s.isPresent);
  const setSkinAnalysisResult = useMirrorStore((s) => s.setSkinAnalysisResult);
  const setSkinCaptureUrl = useMirrorStore((s) => s.setSkinCaptureUrl);
  const captureFrame = useCaptureFrame();

  const [analysisState, setAnalysisState] = useState<SkinAnalysisState>(
    existingResult ? "done" : "idle",
  );
  const firedRef = useRef(!!existingResult);

  useEffect(() => {
    if (!isPresent || firedRef.current) return;
    if (existingResult) {
      firedRef.current = true;
      return;
    }

    const dataUrl = captureFrame();
    if (!dataUrl) return;

    firedRef.current = true;
    setSkinCaptureUrl(dataUrl);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external camera event driving upload state
    setAnalysisState("uploading");

    (async () => {
      try {
        const unsubscribe = await listenForSkinAnalysis({
          onComplete: (data) => {
            console.log("[skin-analysis] ✅ done:", data);
            unsubscribe();
            setSkinAnalysisResult(data as SkinAnalysis);
            setAnalysisState("done");
          },
          onError: (message) => {
            console.log("[skin-analysis] ❌ error:", message);
            unsubscribe();
            setAnalysisState("error");
          },
        });

        const { id: fileId } = await cosmeticsService.uploadCapture(dataUrl);
        setAnalysisState("analyzing");
        await cosmeticsService.startSkinAnalysis(fileId);
      } catch {
        setAnalysisState("error");
      }
    })();
  }, [isPresent, existingResult, captureFrame, setSkinAnalysisResult, setSkinCaptureUrl]);

  return { analysisState };
}
