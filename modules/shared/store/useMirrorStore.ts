import { create } from "zustand";

interface MirrorState {
  /** AI-generated recommendation text to display in Fashion/Cosmetics screens */
  aiSuggestion: string | null;
  setAiSuggestion: (suggestion: string | null) => void;
  clearAiSuggestion: () => void;

  /**
   * Fashion category tags extracted from the AI events[] response (e.g. ["Formal", "SmartCasual"]).
   * Used to filter garments on the fashion recommendation screen based on the user's planned event.
   * Null means no event context — show all garments.
   */
  eventFashionTags: string[] | null;
  setEventFashionTags: (tags: string[] | null) => void;
  clearEventFashionTags: () => void;
  /**
   * Cosmetic tags extracted from the AI events[] response.
   * Used to filter cosmetic products on the cosmetic recommendation screen.
   */
  eventCosmeticTags: string[] | null;
  setEventCosmeticTags: (tags: string[] | null) => void;
  clearEventCosmeticTags: () => void;
}

export const useMirrorStore = create<MirrorState>((set) => ({
  aiSuggestion: null,
  setAiSuggestion: (suggestion) => set({ aiSuggestion: suggestion }),
  clearAiSuggestion: () => set({ aiSuggestion: null }),

  eventFashionTags: null,
  setEventFashionTags: (tags) => set({ eventFashionTags: tags }),
  clearEventFashionTags: () => set({ eventFashionTags: null }),

  eventCosmeticTags: null,
  setEventCosmeticTags: (tags) => set({ eventCosmeticTags: tags }),
  clearEventCosmeticTags: () => set({ eventCosmeticTags: null }),
}));
