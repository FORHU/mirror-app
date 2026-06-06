import { create } from "zustand";
import type { ChatWonderGarmentData } from "@/modules/shared/api/chat-wonder.service";

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
}

export const useMirrorStore = create<MirrorState>((set) => ({
  aiSuggestion: null,
  setAiSuggestion: (suggestion) => set({ aiSuggestion: suggestion }),
  clearAiSuggestion: () => set({ aiSuggestion: null }),
  voiceLanguage: "en-US",
  setVoiceLanguage: (lang) => set({ voiceLanguage: lang }),
  pendingGarmentData: null,
  setPendingGarmentData: (data) => set({ pendingGarmentData: data }),
}));
