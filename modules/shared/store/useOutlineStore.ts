import { create } from "zustand";
import { outlineService } from "@/modules/shared/api/outline.service";

interface OutlineState {
  outlineId: string | null;
  init: () => Promise<void>;
  reset: () => void;
}

export const useOutlineStore = create<OutlineState>((set) => ({
  outlineId: null,

  async init() {
    try {
      const outline = await outlineService.getOrCreate();
      set({ outlineId: outline.id });
    } catch (err) {
      console.warn("[useOutlineStore] Failed to init outline:", err);
    }
  },

  reset() {
    set({ outlineId: null });
  },
}));
