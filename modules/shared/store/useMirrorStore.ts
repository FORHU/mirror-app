import { create } from "zustand";

interface MirrorState {
  /** AI-generated recommendation text to display in Fashion/Cosmetics screens */
  aiSuggestion: string | null;
  setAiSuggestion: (suggestion: string | null) => void;
  clearAiSuggestion: () => void;
  voiceLanguage: string;
  setVoiceLanguage: (lang: string) => void;
}

export const useMirrorStore = create<MirrorState>((set) => ({
  aiSuggestion: null,
  setAiSuggestion: (suggestion) => set({ aiSuggestion: suggestion }),
  clearAiSuggestion: () => set({ aiSuggestion: null }),
  voiceLanguage: "en-US",
  setVoiceLanguage: (lang) => set({ voiceLanguage: lang }),
}));
