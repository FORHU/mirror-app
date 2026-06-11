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
let joinedUserId: string | null = null;

type RegisterUserResponse = {
  status?: "success" | "error";
  userId?: string;
  message?: string;
};

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

function waitForConnect(s: Socket): Promise<void> {
  if (s.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out connecting to analysis socket."));
    }, 8000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      s.off("connect", handleConnect);
      s.off("connect_error", handleError);
    };
    const handleConnect = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    s.on("connect", handleConnect);
    s.on("connect_error", handleError);
  });
}

function registerUserRoom(s: Socket, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Timed out joining analysis result room."));
    }, 8000);

    s.emit("register_user", { userId }, (response?: RegisterUserResponse) => {
      window.clearTimeout(timeout);
      if (response?.status === "error") {
        reject(
          new Error(response.message ?? "Failed to join analysis result room."),
        );
        return;
      }
      joinedUserId = userId;
      resolve();
    });
  });
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

    socket.on("connect", () => {
      if (!socket || !joinedUserId) return;
      registerUserRoom(socket, joinedUserId).catch((error) => {
        console.error("[skin-analysis] failed to rejoin result room:", error);
      });
    });
  }
  const s = socket;
  await waitForConnect(s);
  await registerUserRoom(s, userId);
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
    onError((d as { message?: string })?.message ?? "Skin analysis failed");
  s.on("skin_analysis_complete", complete);
  s.on("skin_analysis_error", fail);
  return () => {
    s.off("skin_analysis_complete", complete);
    s.off("skin_analysis_error", fail);
  };
}
