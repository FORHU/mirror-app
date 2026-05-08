"use client";

import { useEffect, useMemo, useState } from "react";
import { getSocketClient } from "./socket-client";
import {
  KioskLoginPayload,
  KioskRegisteredPayload,
  RegisterKioskPayload,
} from "./socket-events";

const getMirrorName = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }

  return `Mirror ${String.fromCharCode(65 + (hash % 26))}`;
};

export function useKioskSocket() {
  const kioskId = useMemo(() => {
    if (typeof window === "undefined") return crypto.randomUUID();

    const existing = window.sessionStorage.getItem("kiosk_id");
    if (existing) return existing;

    const created = crypto.randomUUID();
    window.sessionStorage.setItem("kiosk_id", created);
    return created;
  }, []);
  const kioskName = useMemo(() => getMirrorName(kioskId), [kioskId]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [waitingForLogin, setWaitingForLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocketClient();

    const handleConnect = () => {
      setIsConnected(true);
      const payload: RegisterKioskPayload = {
        kioskId,
        name: kioskName,
      };
      socket.emit("register_kiosk", payload);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setIsRegistered(false);
    };

    const handleKioskRegistered = (payload: KioskRegisteredPayload) => {
      if (payload.status === "success" && payload.kioskId === kioskId) {
        setIsRegistered(true);
      }
    };

    const handleKioskScanning = (payload: { status?: string }) => {
      if (payload?.status === "pending_login") {
        setWaitingForLogin(true);
      }
    };

    const handleKioskLogin = (payload: KioskLoginPayload) => {
      const username =
        payload?.user?.username ||
        payload?.username ||
        payload?.user?.email ||
        payload?.email ||
        "User";

      setLoggedInUsername(username);
      setIsLoggedIn(true);
      setWaitingForLogin(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("kiosk_registered", handleKioskRegistered);
    socket.on("kiosk_scanning", handleKioskScanning);
    socket.on("kiosk_login", handleKioskLogin);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("kiosk_registered", handleKioskRegistered);
      socket.off("kiosk_scanning", handleKioskScanning);
      socket.off("kiosk_login", handleKioskLogin);
      // Keep the kiosk connected across route changes so it stays in its room.
    };
  }, [kioskId, kioskName]);

  return {
    kioskId,
    kioskName,
    isConnected,
    isRegistered,
    waitingForLogin,
    isLoggedIn,
    loggedInUsername,
  };
}

