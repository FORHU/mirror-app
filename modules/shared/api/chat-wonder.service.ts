import { api } from "@/modules/shared/api/api-client";
import { getStorageData } from "@/modules/shared/utils/storage";
import { ACCESS_TOKEN } from "@/modules/shared/constants/storage-keys";
import { SITEMAP_CONTEXT } from "@/navigation";
import { AudioQueue } from "@/modules/shared/voice/audioQueue";

const API_BASE_URL =
  typeof window !== "undefined"
    ? ""
    : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

// ─── Request ──────────────────────────────────────────────────────────────────

export interface ChatWonderHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface ChatWonderMessageRequest {
  input: string;
  weather?: Record<string, unknown>;
  location?: { lat: number | string; lng: number | string };
  /** Opt-in: ask the backend to synthesize TTS audio for the reply. */
  voice?: boolean;
  /** TTS language, e.g. "en-US", "fr-FR", "ko-KR". Defaults to en-US. */
  lang?: string;
  /**
   * App routes ChatWonder may navigate to for `[nav]` requests. Defaults to the
   * app's full SITEMAP_CONTEXT; pass an explicit list to override/narrow it.
   */
  sitemapContext?: string[];
  history?: ChatWonderHistoryEntry[];
}

// ─── Response ─────────────────────────────────────────────────────────────────

export interface ChatWonderMapsPlace {
  name: string;
  address: string;
  rating: number;
  user_ratings_total: number;
  place_id: string;
  types: string[];
  lat: number;
  lng: number;
  open_now: boolean;
  photo_url: string | null;
  price_level: number | null;
  phone_number: string | null;
  website: string | null;
}

export interface ChatWonderMapsData {
  success: boolean;
  query: string;
  location_label: string;
  lat: number;
  lng: number;
  radius: number;
  search_mode: string;
  total_results: number;
  places: ChatWonderMapsPlace[];
}

export interface ChatWonderMessageResponse {
  message: string;
  audioBase64: string | null;
  intent: string;
  garment_data: ChatWonderGarmentData | null;
  cosmetics_data: unknown | null;
  maps_data: ChatWonderMapsData[] | null;
  stylist_data: ChatWonderStylistData | null;
  events?: ChatWonderEvent[];
  sets?: unknown[];
  metadata: {
    conversationId: string;
    userMessageId: string;
    aiMessageId: string;
  };
}

export interface ChatWonderStylistData {
  /** Route to navigate to — one of the app's SITEMAP_CONTEXT entries. */
  target_url: string;
  confidence?: number;
  extracted_entities?: unknown | null;
  system_message?: string;
}

export interface ChatWonderEventMap {
  destination?: string;
  lat?: number;
  lng?: number;
  address?: string;
  placeId?: string;
}

export interface ChatWonderEvent {
  eventName?: string;
  eventType?: string;
  timeLabel?: string;
  map?: ChatWonderEventMap | null;
}

export interface ChatWonderGarmentData {
  success: boolean;
  gender: string;
  event_type?: string;
  event_date?: string;
  location?: string;
  sets_requested?: number;
  sets: ChatWonderSet[];
  weather_note?: string;
  styling_tips?: string[];
}

export interface ChatWonderSet {
  set_number: number;
  outfit_id: string;
  vibe: string;
  trend_note: string;
  reason: string;
  outfit_name: string;
  outfit_description: string;
  outfit_imageUrl: string;
  recommendations: ChatWonderRecommendation[];
}

export interface ChatWonderRecommendation {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  fittingSlot: string[];
  garmentType: string[];
  category: string[];
  layerLevel?: string;
  silhouette?: string;
}

// ─── Token helper (mirrors api-client.ts interceptor logic) ──────────────────

function getKioskAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.hostname === process.env.NEXT_PUBLIC_DOMAIN2
    ? (process.env.NEXT_PUBLIC_USER2_ACCESS_TOKEN ?? null)
    : (process.env.NEXT_PUBLIC_USER1_ACCESS_TOKEN ?? null);
}

export async function resolveAccessToken(): Promise<string | null> {
  const kioskToken = getKioskAccessToken();
  if (kioskToken) return kioskToken;

  const stored = await getStorageData<string>(ACCESS_TOKEN);
  if (stored) return stored;

  return null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const chatWonderService = {
  /**
   * Fetch (or force-regenerate) the ChatWonder session ID.
   * Call once on landing to clear remote conversation history.
   */
  async getSessionId(): Promise<string> {
    const res = await api.get<{ status: string; data: { sessionId: string } }>(
      "/api/mirror/chat-wonder/session-id",
    );
    if (!res.ok || !res.data?.data?.sessionId) {
      throw new Error("Failed to retrieve ChatWonder session ID");
    }
    return res.data.data.sessionId;
  },

  /**
   * RESTART — for the next person at the mirror: nulls the user's stored gender
   * and forces a brand-new ChatWonder session (clears history). Returns the new
   * session ID. Does NOT clear the itinerary (see `outlineService.reset`).
   */
  async restart(): Promise<string> {
    const res = await api.post<{
      status: string;
      data: { sessionId: string; gender: null };
    }>("/api/mirror/chat-wonder/restart", {});
    if (!res.ok || !res.data?.data?.sessionId) {
      throw new Error("Failed to restart ChatWonder session");
    }
    return res.data.data.sessionId;
  },

  /**
   * Send a message to the chat-wonder endpoint and return the full response.
   * Pass an AbortSignal to cancel the request mid-flight.
   */
  async message(
    request: ChatWonderMessageRequest,
    signal?: AbortSignal,
  ): Promise<ChatWonderMessageResponse> {
    const token = await resolveAccessToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-platform": "kiosk",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const body: Record<string, unknown> = { input: request.input };
    if (request.weather) body.weather = request.weather;
    if (request.location) body.location = request.location;
    if (request.voice) body.voice = request.voice;
    if (request.lang) body.lang = request.lang;
    if (request.history?.length) body.history = request.history;
    body.sitemap_context = request.sitemapContext ?? SITEMAP_CONTEXT;

    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/api/mirror/chat-wonder/message`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } catch (err: unknown) {
      throw new Error((err as Error).message ?? "Network error");
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const audioQueue = new AudioQueue();
    let finalData: ChatWonderMessageResponse | null = null;

    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === "audio_chunk" && parsed.audioBase64) {
                audioQueue.enqueue(parsed.audioBase64);
              } else if (parsed.type === "complete") {
                finalData = parsed as ChatWonderMessageResponse;
              } else if (parsed.type === "error") {
                audioQueue.stop();
                if (parsed.code === "session_expired") {
                  throw new Error("Session expired. Please resend your message.");
                }
                throw new Error(parsed.message || "Stream error");
              }
            } catch {
              // ignore partial json
            }
          }
        }
      }
    }

    if (!finalData) {
      throw new Error("Did not receive complete event");
    }

    if (finalData.audioBase64) {
      finalData.audioBase64 = null; // Prevent double playback by callers, AudioQueue handled it
    }

    return finalData;
  },
};
