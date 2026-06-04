"use client";

import { io, type Socket } from "socket.io-client";
import { resolveAccessToken } from "@/modules/shared/api/chat-wonder.service";

/**
 * Skin analysis is asynchronous on the backend: POST /skin-analyses returns
 * 202 ("started") and the finished result is pushed over Socket.io as
 * `skin_analysis_complete` (or `skin_analysis_error`) to the room
 * `user:${userId}`. This helper owns the single shared socket connection and
 * lets a component subscribe for one analysis run.
 */

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

let socket: Socket | null = null;

/** Pull the userId out of the JWT (payload field is `userId`). */
function decodeUserId(token: string): string | null {
  try {
    const part = token.split(".")[1];
    const b64 = part
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(part.length + ((4 - (part.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(b64));
    return payload.userId ?? payload.id ?? payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Connect (once) and join the user's room, re-joining on every reconnect. */
async function ensureSocket(): Promise<Socket | null> {
  if (typeof window === "undefined") return null;
  const token = await resolveAccessToken();
  if (!token) return null;
  const userId = decodeUserId(token);
  if (!userId) return null;

  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });
  }
  const s = socket;
  const join = () => s.emit("register_user", { userId });
  // join now if already connected, and on every (re)connect
  if (s.connected) join();
  s.off("connect", join); // avoid stacking duplicate handlers across calls
  s.on("connect", join);
  return s;
}

export type SkinAnalysisHandlers = {
  onComplete: (data: unknown) => void;
  onError: (message: string) => void;
};

/**
 * Subscribe to the next skin-analysis result. Returns an unsubscribe function
 * that removes just these listeners (the shared socket stays connected).
 * Call this BEFORE POSTing /skin-analyses so the push can't race ahead of us.
 */
export async function listenForSkinAnalysis({
  onComplete,
  onError,
}: SkinAnalysisHandlers): Promise<() => void> {
  const s = await ensureSocket();
  if (!s) {
    onError("Not signed in — can't receive analysis result.");
    return () => {};
  }
  const complete = (d: unknown) => onComplete(d);
  const fail = (d: unknown) =>
    onError(
      (d as { message?: string })?.message ?? "Skin analysis failed",
    );
  s.on("skin_analysis_complete", complete);
  s.on("skin_analysis_error", fail);
  return () => {
    s.off("skin_analysis_complete", complete);
    s.off("skin_analysis_error", fail);
  };
}
