"use client";

export interface RegisterKioskPayload {
  kioskId: string;
}

export interface KioskRegisteredPayload {
  status: "success" | "failed";
  kioskId: string;
}

