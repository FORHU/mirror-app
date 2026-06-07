import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMapStore } from "@/modules/map/store/useMapStore";
import type { PendingEvent } from "@/modules/shared/ai/chatwonder.types";
import {
  chatWonderService,
  resolveAccessToken,
} from "@/modules/shared/api/chat-wonder.service";
import { SITEMAP_CONTEXT } from "@/navigation";
import { handleStylistTarget } from "@/modules/shared/voice/sessionCommands";
import { AudioQueue } from "@/modules/shared/voice/audioQueue";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";

interface ItineraryMap {
  destination?: string;
  lat?: number;
  lng?: number;
  address?: string;
  placeId?: string;
}

export interface ChatMessage {
  id: string;
  role: "USER" | "AI";
  content: string;
}

/**
 * Shape of the SSE `complete` event emitted by the backend chat-wonder stream.
 * The structured tool blocks (`garment` / `cosmetics` / `maps` / `nav`) are
 * `null` unless ChatWonder actually fired that tool. Kept loosely typed here —
 * consumers narrow each block against the richer types in chat-wonder.service.
 */
export interface ChatWonderCompletePayload {
  type: "complete";
  message?: string;
  garment?: unknown | null;
  garment_data?: unknown | null;
  cosmetics?: unknown | null;
  cosmetics_data?: unknown | null;
  maps?: unknown | null;
  maps_data?: unknown | null;
  nav?: unknown | null;
  nav_data?: unknown | null;
  events?: unknown[];
  sets?: unknown[];
  raw?: string;
}

export interface SendMessageOptions {
  conversationId?: string;
  mode?: "garments" | "cosmetics" | "overview" | "map" | "default";
  weather?: unknown;
  /**
   * Optional: fires once when the stream's `complete` event arrives, carrying
   * the full structured payload (tool results). Non-breaking — existing callers
   * that don't pass this are unaffected.
   */
  onComplete?: (payload: ChatWonderCompletePayload) => void;
  /**
   * Optional: fires as soon as a `[NAV_DATA]` block is detected mid-stream,
   * before the tool finishes. Used by ChatWonderProvider to navigate early.
   */
  onNavEarly?: (stylistData: { target_url?: string } | null) => void;
}

export interface UseChatWonderStreamResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (text: string, options?: SendMessageOptions) => Promise<void>;
  clearMessages: () => void;
}

export function useChatWonderStream(): UseChatWonderStreamResult {
  const router = useRouter();
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep track of the AbortController so we can cancel streams if needed
  const abortControllerRef = useRef<AbortController | null>(null);

  const audioQueueRef = useRef<AudioQueue | null>(null);

  useEffect(() => {
    // Initialize AudioQueue on mount
    audioQueueRef.current = new AudioQueue();
    return () => {
      // Stop and clean up on unmount
      if (audioQueueRef.current) {
        audioQueueRef.current.stop();
      }
    };
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async function doSendMessage(
      text: string,
      options?: SendMessageOptions,
      kioskId?: string,
      didRefreshSession = false,
    ) {
      if (!text.trim()) return;

      // Abort any ongoing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsStreaming(true);
      setError(null);

      // Optimistically add the user message
      const userMsgId = Date.now().toString();
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "USER", content: text },
      ]);

      // Create a placeholder for the AI response
      const aiMsgId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: aiMsgId, role: "AI", content: "" },
      ]);

      try {
        const token = await resolveAccessToken();
        let finalInput = text;
        if (options?.mode === "map") {
          finalInput = `[stylist] ${text}`;
        } else if (options?.mode === "garments") {
          finalInput = `[stylist] ${text}`;
        } else if (options?.mode === "cosmetics") {
          finalInput = `[stylist] ${text}`;
        } else if (options?.mode === "overview") {
          finalInput = `[stylist] ${text}`;
        }

        // Stop any currently playing audio before starting a new stream
        if (audioQueueRef.current) {
          audioQueueRef.current.stop();
        }

        const response = await fetch("/api/mirror/chat-wonder/message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            input: finalInput,
            conversationId: options?.conversationId,
            weather: options?.weather ?? null,
            voice: true,
            kioskId,
            sitemap_context: SITEMAP_CONTEXT,
            skin_analysis: useMirrorStore.getState().skinAnalysisResult,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          if (response.status === 409 && !didRefreshSession) {
            await chatWonderService.restart();
            setMessages((prev) =>
              prev.filter((m) => m.id !== userMsgId && m.id !== aiMsgId),
            );
            await doSendMessage(text, options, kioskId, true);
            return;
          }
          throw new Error(`Server responded with status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body available from the server");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        let aiContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE messages are separated by double newlines
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.replace("data: ", "");
              try {
                const parsed = JSON.parse(jsonStr);

                if (parsed.type === "chunk") {
                  aiContent += parsed.content;
                  // Update the AI message in state
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMsgId ? { ...msg, content: aiContent } : msg,
                    ),
                  );
                } else if (
                  parsed.type === "audio_chunk" &&
                  parsed.audioBase64
                ) {
                  // Enqueue the incoming chunked audio for gapless playback
                  if (audioQueueRef.current) {
                    audioQueueRef.current.enqueue(parsed.audioBase64);
                  }
                } else if (parsed.type === "complete") {
                  console.log("Chat completed with data:", parsed);

                  const completePayload = {
                    ...parsed,
                    garment: parsed.garment ?? parsed.garment_data ?? null,
                    cosmetics:
                      parsed.cosmetics ?? parsed.cosmetics_data ?? null,
                    maps:
                      parsed.maps ??
                      (Array.isArray(parsed.maps_data)
                        ? parsed.maps_data[0]
                        : parsed.maps_data) ??
                      null,
                    nav: parsed.nav ?? parsed.nav_data ?? null,
                  } as ChatWonderCompletePayload;

                  // Surface the full structured payload (tool results) to any
                  // opt-in consumer before we run the built-in map handling.
                  options?.onComplete?.(completePayload);

                  const {
                    clearPendingEvents,
                    setPendingEvents,
                    setDestination,
                    setItineraryStops,
                  } = useMapStore.getState();

                  clearPendingEvents();

                  type ParsedEvent = {
                    eventName?: string;
                    eventType?: string;
                    timeLabel?: string;
                    map?: ItineraryMap;
                  };
                  const responseEvents = Array.isArray(parsed.events)
                    ? (parsed.events as ParsedEvent[])
                    : [];
                  const resolved = responseEvents.filter(
                    (e) =>
                      typeof e?.map?.lat === "number" &&
                      typeof e?.map?.lng === "number",
                  );
                  const incomplete = responseEvents.filter(
                    (e) =>
                      !(
                        typeof e?.map?.lat === "number" &&
                        typeof e?.map?.lng === "number"
                      ),
                  );

                  if (incomplete.length > 0) {
                    setPendingEvents(
                      incomplete.map(
                        (e): PendingEvent => ({
                          eventName: e.eventName ?? "event",
                          eventType: e.eventType ?? "general",
                          timeLabel: e.timeLabel ?? "",
                          missingFields: [
                            ...(!e.timeLabel ? (["time"] as const) : []),
                            "location" as const,
                          ],
                        }),
                      ),
                    );
                  }

                  if (incomplete.length === 0 && resolved.length > 0) {
                    const stops = resolved.map((e) => ({
                      name: e.map!.destination ?? "Destination",
                      lat: e.map!.lat as number,
                      lng: e.map!.lng as number,
                      address: e.map!.address,
                      placeId: e.map!.placeId,
                    }));
                    if (stops.length === 1) {
                      setDestination(stops[0]);
                    } else {
                      setItineraryStops(stops);
                    }
                  }

                  // Handle AI-driven page navigation via [STYLIST] block
                  const stylistData = (parsed.stylist ??
                    parsed.stylist_data) as
                    | { target_url?: string }
                    | null
                    | undefined;
                  // Also support legacy [nav] block for backward compat
                  const nav = completePayload.nav as
                    | { target_url?: string }
                    | null
                    | undefined;
                  const navTarget = stylistData?.target_url ?? nav?.target_url;
                  if (navTarget) {
                    void handleStylistTarget(navTarget, router, pathname);
                  }
                } else if (parsed.type === "nav_early") {
                  options?.onNavEarly?.(
                    (parsed.stylist_data as { target_url?: string } | null) ?? null,
                  );
                } else if (parsed.type === "error") {
                  if (parsed.code === "session_expired") {
                    console.warn("Session expired, retrying message...");
                    if (didRefreshSession) {
                      setError(parsed.message || "ChatWonder session expired");
                      return;
                    }
                    await chatWonderService.restart();
                    // Try removing the message we optimistically added so we don't double up
                    setMessages((prev) =>
                      prev.filter(
                        (m) => m.id !== userMsgId && m.id !== aiMsgId,
                      ),
                    );
                    await doSendMessage(text, options, kioskId, true);
                    return;
                  }
                  setError(parsed.message || "Unknown ChatWonder error");
                }
              } catch {
                // incomplete chunk
              }
            }
          }
        }
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        if (e?.name !== "AbortError") {
          console.error("Stream error:", err);
          setError(
            e?.message ||
              "An error occurred while communicating with ChatWonder.",
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [router, pathname],
  );

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
  };
}
