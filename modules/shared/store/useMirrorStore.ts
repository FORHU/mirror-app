import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChatWonderGarmentData } from "@/modules/shared/api/chat-wonder.service";
import type { SkinAnalysis } from "@/modules/shared/api/cosmetics.service";
import type { TrackerStatus } from "@/modules/shared/hooks/useProximitySensor";
import type {
  CosmeticTileItem,
  GarmentTileItem,
  OutfitTileItem,
} from "@/modules/overview/types";

interface OverviewFashionSnapshot {
  garments: GarmentTileItem[];
  outfits: OutfitTileItem[];
}

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
  /** Camera presence, mirrored from useProximitySensor so global consumers
   *  (VoiceProvider) can gate on it without running their own camera. Ephemeral
   *  — excluded from persistence so it never survives a reload. */
  isPresent: boolean;
  sensorStatus: TrackerStatus;
  setPresence: (isPresent: boolean, sensorStatus: TrackerStatus) => void;
  /** Whether the GlobalVoiceOverlay chat panel is open. Lifted here so
   *  OutfitPreviewModal can open it programmatically to ask for gender. */
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  /** True while /ai-assistant sits on its idle "Tap to start" welcome screen.
   *  Lets GlobalVoiceOverlay hide the shared mic there so the spoken greeting
   *  gate isn't bypassed. Ephemeral — never persisted. */
  assistantIdle: boolean;
  setAssistantIdle: (idle: boolean) => void;
  /** Chat-path early navigation state (set on nav_early, cleared on complete) */
  chatNavPending: boolean;
  setChatNavPending: (pending: boolean) => void;
  /** Miraj's live streaming text — shown as loading state on destination screen */
  chatStreamingText: string;
  setChatStreamingText: (text: string) => void;
  /** Garment data from chat path (nav_early flow). Consumed once by fashion page. */
  chatGarmentData: ChatWonderGarmentData | null;
  setChatGarmentData: (data: ChatWonderGarmentData | null) => void;
  /** Cosmetics data from chat path (nav_early flow). Consumed once by cosmetics page. */
  chatCosmeticsData: unknown | null;
  setChatCosmeticsData: (data: unknown | null) => void;
  /** Tailor-generated outfit image from chat path. Consumed once by OutfitPreviewModal. */
  chatTailorData: { image_url: string; gender: string } | null;
  setChatTailorData: (data: { image_url: string; gender: string } | null) => void;
  /** Last normalized fashion data shown on /ai-recommendation-fashion, for /overview mini cards. */
  overviewFashionSnapshot: OverviewFashionSnapshot | null;
  setOverviewFashionSnapshot: (data: OverviewFashionSnapshot | null) => void;
  /** Last normalized cosmetic recommendations shown on /ai-recommendation-cosmetic. */
  overviewCosmeticsSnapshot: CosmeticTileItem[] | null;
  setOverviewCosmeticsSnapshot: (data: CosmeticTileItem[] | null) => void;
  clearChatNav: () => void;
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
      isPresent: false,
      sensorStatus: "starting",
      setPresence: (isPresent, sensorStatus) =>
        set({ isPresent, sensorStatus }),
      isChatOpen: false,
      setIsChatOpen: (open) => set({ isChatOpen: open }),
      assistantIdle: false,
      setAssistantIdle: (idle) => set({ assistantIdle: idle }),
      chatNavPending: false,
      setChatNavPending: (pending) => set({ chatNavPending: pending }),
      chatStreamingText: "",
      setChatStreamingText: (text) => set({ chatStreamingText: text }),
      chatGarmentData: null,
      setChatGarmentData: (data) => set({ chatGarmentData: data }),
      chatCosmeticsData: null,
      setChatCosmeticsData: (data) => set({ chatCosmeticsData: data }),
      chatTailorData: null,
      setChatTailorData: (data) => set({ chatTailorData: data }),
      overviewFashionSnapshot: null,
      setOverviewFashionSnapshot: (data) =>
        set({ overviewFashionSnapshot: data }),
      overviewCosmeticsSnapshot: null,
      setOverviewCosmeticsSnapshot: (data) =>
        set({ overviewCosmeticsSnapshot: data }),
      clearChatNav: () =>
        set({
          chatNavPending: false,
          chatStreamingText: "",
          chatGarmentData: null,
          chatCosmeticsData: null,
          chatTailorData: null,
        }),
    }),
    {
      name: "mirror-storage",
      storage: createJSONStorage(() => sessionStorage),
      // Persist only durable fields — presence is live camera state and must
      // never be restored from a previous session.
      partialize: (state) => ({
        aiSuggestion: state.aiSuggestion,
        voiceLanguage: state.voiceLanguage,
        pendingGarmentData: state.pendingGarmentData,
        pendingCosmeticsData: state.pendingCosmeticsData,
        skinAnalysisResult: state.skinAnalysisResult,
        skinCaptureUrl: state.skinCaptureUrl,
        overviewFashionSnapshot: state.overviewFashionSnapshot,
        overviewCosmeticsSnapshot: state.overviewCosmeticsSnapshot,
      }),
    },
  ),
);
