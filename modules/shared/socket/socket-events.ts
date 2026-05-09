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
}

