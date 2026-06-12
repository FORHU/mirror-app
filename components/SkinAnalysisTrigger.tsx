"use client";

import { useSkinAnalysisCapture } from "@/modules/shared/hooks/useSkinAnalysisCapture";

/**
 * Fires skin analysis as soon as the user is first detected (isPresent = true).
 * Mounted globally in layout so the result is ready well before the user
 * reaches the Cosmetics page.
 */
export function SkinAnalysisTrigger() {
  useSkinAnalysisCapture();
  return null;
}
