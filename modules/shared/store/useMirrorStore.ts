import { create } from "zustand";

interface MirrorState {
  /** AI-generated recommendation text to display in Fashion/Cosmetics screens */
  aiSuggestion: string | null;
  setAiSuggestion: (suggestion: string | null) => void;
  clearAiSuggestion: () => void;
}

export const useMirrorStore = create<MirrorState>((set) => ({
  aiSuggestion: null,
  setAiSuggestion: (suggestion) => set({ aiSuggestion: suggestion }),
  clearAiSuggestion: () => set({ aiSuggestion: null }),
}));
