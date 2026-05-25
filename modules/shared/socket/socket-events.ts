"use client";

export interface RegisterKioskPayload {
  kioskId: string;
  name: string;
  secret: string;
}

export interface KioskRegisteredPayload {
  status: "success" | "failed";
  kioskId: string;
}

// kiosk_login has two backend payload shapes:
//  1. { accessToken, refreshToken, user: { id, email, username } }  — login / pairMirror
//  2. Raw Prisma User at root { id, email, username, gender, … }    — updateProfile (no tokens)
export interface KioskLoginPayload {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id?: string;
    username?: string;
    email?: string;
    displayName?: string;
  };
  // Top-level fields present in the raw-user shape (updateProfile)
  id?: string;
  username?: string;
  email?: string;
}

// ─── ChatWonder events ────────────────────────────────────────────────────────

export {
  type ChatWonderInput as ChatWonderInputPayload,
  type ChatWonderResponse as ChatWonderResponsePayload,
} from "../ai/chatwonder.types";

export const CHATWONDER_INPUT = "chatwonder_input" as const;
export const CHATWONDER_RESPONSE = "chatwonder_response" as const;
