import { api } from "@/modules/shared/api/api-client";
import { getStorageData } from "@/modules/shared/utils/storage";
import { ACCESS_TOKEN } from "@/modules/shared/constants/storage-keys";
import { SITEMAP_CONTEXT } from "@/navigation";
import type { SkinAnalysis } from "@/modules/shared/api/cosmetics.service";

const API_BASE_URL =
  typeof window !== "undefined"
    ? ""
    : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

// ─── Request ──────────────────────────────────────────────────────────────────

export interface ChatWonderMessageRequest {
  input: string;
  location?: { lat: number | string; lng: number | string };
  weather?: Record<string, unknown>;
  /** Opt-in: ask the backend to synthesize TTS audio for the reply. */
  voice?: boolean;
  /** TTS language, e.g. "en-US", "fr-FR", "ko-KR". Defaults to en-US. */
  lang?: string;
  /**
   * App routes ChatWonder may navigate to for `[nav]` requests. Defaults to the
   * app's full SITEMAP_CONTEXT; pass an explicit list to override/narrow it.
   */
  sitemapContext?: string[];
  skinAnalysis?: SkinAnalysis | null;
  /** Current page mode — tells the backend which parameters to forward and which intent tag to use. */
  pageMode?: "garment" | "cosmetics" | "map" | "overview" | null;
  /** Fashion category filter forwarded from the catalog page (e.g. "metaCategory=Winterwear,Summerwear" or "ALL"). */
  category?: string;
  /** Number of cosmetic product IDs to return. */
  set?: number;
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
  cosmetics_data: ChatWonderCosmeticsData | null;
  maps_data: ChatWonderMapsData | null;
  stylist_data: ChatWonderStylistData | null;
  tailor_data: { image_url: string; gender: string } | null;
  gender_update?: { gender: string } | null;
  events?: ChatWonderEvent[];
  sets?: unknown[];
  metadata: {
    conversationId: string;
    userMessageId: string;
    aiMessageId?: string;
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

export interface ChatWonderGarmentRecommendation {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  fittingSlot: string[];
  garmentType: string[];
  category: string[];
  layerLevel: string;
  silhouette: string;
}

export interface ChatWonderGarmentSet {
  set_number: number;
  outfit_id: string;
  outfit_name: string;
  outfit_description: string;
  outfit_imageUrl: string;
  vibe: string;
  reason: string;
  recommendations: ChatWonderGarmentRecommendation[];
}

export interface ChatWonderGarmentData {
  query: string;
  reason?: string;
  /** Present when the backend has already resolved the query into outfit sets. */
  success?: boolean;
  sets?: ChatWonderGarmentSet[];
}

export interface ChatWonderCosmeticsData {
  query?: string;
  recommendations?: unknown[];
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
   * Read-only: the current ChatWonder session ID. Unlike getSessionId, this
   * never resets the remote conversation — safe for display/debug UI.
   */
  async getCurrentSessionId(): Promise<string> {
    const res = await api.get<{ status: string; data: { sessionId: string } }>(
      "/api/mirror/chat-wonder/session-id/current",
    );
    if (!res.ok || !res.data?.data?.sessionId) {
      throw new Error("Failed to retrieve current ChatWonder session ID");
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
   *
   * Retries once on session_expired: the backend clears its stale ChatWonder
   * session before emitting that error, so an immediate resend gets a fresh
   * session (otherwise the first utterance after a long idle always fails).
   */
  async message(
    request: ChatWonderMessageRequest,
    options?: ChatWonderMessageOptions,
  ): Promise<ChatWonderMessageResponse> {
    try {
      return await sendMessageOnce(request, options);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Session expired")) {
        return sendMessageOnce(request, options);
      }
      throw err;
    }
  },
};

export interface ChatWonderMessageOptions {
  onChunk?: (text: string) => void;
  onAudioChunk?: () => void;
  signal?: AbortSignal;
  /** Skip the internal AudioQueue playback. Use when the caller speaks its
   *  own (curated) reply via TTS — otherwise both play at once (dual voice). */
  silent?: boolean;
}

async function sendMessageOnce(
  request: ChatWonderMessageRequest,
  options?: ChatWonderMessageOptions,
): Promise<ChatWonderMessageResponse> {
  const token = await resolveAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-platform": "kiosk",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const body: Record<string, unknown> = { input: request.input };
  if (request.location) body.location = request.location;
  if (request.weather) body.weather = request.weather;
  // Universally disable voice per user request
  body.voice = false;
  if (request.lang) body.lang = request.lang;
  if (request.skinAnalysis) body.skin_analysis = request.skinAnalysis;
  if (request.pageMode) body.page_mode = request.pageMode;
  if (request.category) body.category = request.category;
  if (request.set !== undefined) body.set = request.set;
  body.sitemap_context = request.sitemapContext ?? SITEMAP_CONTEXT;

  const signal = options?.signal;
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

  // Globally disable AudioQueue
  let finalData: ChatWonderMessageResponse | null = null;

  if (res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let audioNotified = false;

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

          // Parse in its own try/catch — error events below must throw to
          // the caller, not be swallowed by the partial-JSON guard.
          let parsed: {
            type?: string;
            audioBase64?: string;
            content?: string;
            code?: string;
            message?: string;
          };
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            continue; // partial json
          }

          if (parsed.type === "audio_chunk" && parsed.audioBase64) {
            if (!audioNotified) {
              audioNotified = true;
              try {
                options?.onAudioChunk?.();
              } catch {}
            }
            // audio disabled
          } else if (parsed.type === "chunk") {
            // Stream textual chunks to the caller if provided
            try {
              options?.onChunk?.(parsed.content ?? "");
            } catch {}
          } else if (parsed.type === "raw_chunk") {
            try {
              options?.onChunk?.(parsed.content ?? "");
            } catch {}
          } else if (parsed.type === "complete") {
            finalData = parsed as unknown as ChatWonderMessageResponse;
          } else if (parsed.type === "error") {
            // audio disabled
            if (parsed.code === "session_expired") {
              throw new Error("Session expired. Please resend your message.");
            }
            throw new Error(parsed.message || "Stream error");
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
}
