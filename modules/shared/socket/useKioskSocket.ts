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

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("kiosk_registered", handleKioskRegistered);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("kiosk_registered", handleKioskRegistered);
      socket.disconnect();
    };
  }, [kioskId]);

  return { kioskId, isConnected, isRegistered };
}

