"use client";

export interface RegisterKioskPayload {
  kioskId: string;
  name: string;
}

export interface KioskRegisteredPayload {
  status: "success" | "failed";
  kioskId: string;
}

export interface KioskLoginPayload {
  user?: {
    username?: string;
    email?: string;
  };
  username?: string;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
}

// ─── ChatWonder events ────────────────────────────────────────────────────────

export { type ChatWonderInput as ChatWonderInputPayload, type ChatWonderResponse as ChatWonderResponsePayload } from "../ai/chatwonder.types";

export const CHATWONDER_INPUT    = "chatwonder_input"    as const;
export const CHATWONDER_RESPONSE = "chatwonder_response" as const;

