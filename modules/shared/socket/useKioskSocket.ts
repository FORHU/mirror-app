"use client";

import { useEffect, useMemo, useState } from "react";
import { getSocketClient } from "./socket-client";
import {
  KioskLoginPayload,
  KioskRegisteredPayload,
  RegisterKioskPayload,
} from "./socket-events";
import { MIRRORS, MirrorKey } from "../constants/mirrors";
import { setCachedAccessToken } from "../api/api-client";
import { setStorageData } from "../utils/storage";
import { ACCESS_TOKEN, REFRESH_TOKEN, USER } from "../constants/storage-keys";

export function useKioskSocket(mirrorIdOverride?: MirrorKey) {
  const kioskId = useMemo(() => {
    if (typeof window === "undefined") return mirrorIdOverride ?? "mirror-a";

    if (mirrorIdOverride) {
      window.sessionStorage.setItem("kiosk_id", mirrorIdOverride);
      return mirrorIdOverride;
    }

    return (window.sessionStorage.getItem("kiosk_id") as MirrorKey) ?? "mirror-a";
  }, [mirrorIdOverride]);

  const kioskName = useMemo(
    () => MIRRORS[kioskId as MirrorKey]?.name ?? kioskId,
    [kioskId],
  );
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

      // Store auth tokens so the kiosk can make authenticated API calls
      if (payload?.accessToken) {
        setCachedAccessToken(payload.accessToken);
        setStorageData(ACCESS_TOKEN, payload.accessToken);
      }
      if (payload?.refreshToken) {
        setStorageData(REFRESH_TOKEN, payload.refreshToken);
      }
      if (payload?.user) {
        setStorageData(USER, payload.user);
      }

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

