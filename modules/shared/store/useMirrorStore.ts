import { create } from "zustand";

export interface WeatherCache {
  temperature: number;
  condition: string;
  icon: string;
  windspeed: number;
  humidity: number;
  precipitationProb: number;
  lat: number;
  lon: number;
  date: string;
  is_cold: boolean;
  is_hot: boolean;
  is_rainy: boolean;
  fetchedAt: number;
}

interface MirrorState {
  /** AI-generated recommendation text to display in Fashion/Cosmetics screens */
  aiSuggestion: string | null;
  setAiSuggestion: (suggestion: string | null) => void;
  clearAiSuggestion: () => void;
  voiceLanguage: string;
  setVoiceLanguage: (lang: string) => void;
  weatherCache: WeatherCache | null;
  setWeatherCache: (cache: WeatherCache) => void;
}

export const useMirrorStore = create<MirrorState>((set) => ({
  aiSuggestion: null,
  setAiSuggestion: (suggestion) => set({ aiSuggestion: suggestion }),
  clearAiSuggestion: () => set({ aiSuggestion: null }),
  voiceLanguage: "en-US",
  setVoiceLanguage: (lang) => set({ voiceLanguage: lang }),
  weatherCache: null,
  setWeatherCache: (cache) => set({ weatherCache: cache }),
}));
