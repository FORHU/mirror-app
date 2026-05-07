"use client";

import { useEffect, useMemo, useState } from "react";
import { getSocketClient } from "./socket-client";
import {
  KioskRegisteredPayload,
  RegisterKioskPayload,
} from "./socket-events";

export function useKioskSocket() {
  const kioskId = useMemo(() => crypto.randomUUID(), []);
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [waitingForLogin, setWaitingForLogin] = useState(false);

  useEffect(() => {
    const socket = getSocketClient();

    const handleConnect = () => {
      setIsConnected(true);
      const payload: RegisterKioskPayload = { kioskId };
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
      console.log("Waiting to login")
      if (payload?.status === "pending_login") {
        console.log("Waiting to login")
        setWaitingForLogin(true);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("kiosk_registered", handleKioskRegistered);
    socket.on("kiosk_scanning", handleKioskScanning);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("kiosk_registered", handleKioskRegistered);
      socket.off("kiosk_scanning", handleKioskScanning);
      socket.disconnect();
    };
  }, [kioskId]);

  return { kioskId, isConnected, isRegistered, waitingForLogin };
}

