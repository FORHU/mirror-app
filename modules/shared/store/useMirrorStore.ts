import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChatWonderGarmentData } from "@/modules/shared/api/chat-wonder.service";
import type { SkinAnalysis } from "@/modules/shared/api/cosmetics.service";

interface MirrorState {
  /** AI-generated recommendation text to display in Fashion/Cosmetics screens */
  aiSuggestion: string | null;
  setAiSuggestion: (suggestion: string | null) => void;
  clearAiSuggestion: () => void;
  voiceLanguage: string;
  setVoiceLanguage: (lang: string) => void;
  /** Garment data passed from /ai-assistant → /ai-recommendation-fashion via router.push. Consumed once on mount and cleared. */
  pendingGarmentData: ChatWonderGarmentData | null;
  setPendingGarmentData: (data: ChatWonderGarmentData | null) => void;
  /** Cosmetics data passed from ChatWonder voice navigation. Consumed once on mount. */
  pendingCosmeticsData: unknown | null;
  setPendingCosmeticsData: (data: unknown | null) => void;
  /** Background skin analysis result */
  skinAnalysisResult: SkinAnalysis | null;
  setSkinAnalysisResult: (result: SkinAnalysis | null) => void;
  /** Image URL of the captured face used for skin analysis */
  skinCaptureUrl: string | null;
  setSkinCaptureUrl: (url: string | null) => void;
}

export const useMirrorStore = create<MirrorState>()(
  persist(
    (set) => ({
      aiSuggestion: null,
      setAiSuggestion: (suggestion) => set({ aiSuggestion: suggestion }),
      clearAiSuggestion: () => set({ aiSuggestion: null }),
      voiceLanguage: "en-US",
      setVoiceLanguage: (lang) => set({ voiceLanguage: lang }),
      pendingGarmentData: null,
      setPendingGarmentData: (data) => set({ pendingGarmentData: data }),
      pendingCosmeticsData: null,
      setPendingCosmeticsData: (data) => set({ pendingCosmeticsData: data }),
      skinAnalysisResult: null,
      setSkinAnalysisResult: (result) => set({ skinAnalysisResult: result }),
      skinCaptureUrl: null,
      setSkinCaptureUrl: (url) => set({ skinCaptureUrl: url }),
    }),
    {
      name: "mirror-storage",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
