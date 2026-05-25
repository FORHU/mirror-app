"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSocketClient } from "@/modules/shared/socket/socket-client";
import { ROUTES } from "@/navigation";
import { setCachedAccessToken } from "@/modules/shared/api/api-client";
import { setStorageData } from "@/modules/shared/utils/storage";
import { setAuthCookie } from "@/modules/shared/utils/auth-cookie";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import {
  ACCESS_TOKEN,
  REFRESH_TOKEN,
  USER,
} from "@/modules/shared/constants/storage-keys";
import type { KioskLoginPayload } from "@/modules/shared/socket/socket-events";
import type { User } from "@/modules/shared/api/api.types";

export function KioskNotificationListener() {
  const router = useRouter();

  useEffect(() => {
    const socket = getSocketClient();

    const notificationHandler = (data: unknown) => {
      const { action } = data as { action: string };
      if (action === "waiting_login") {
        router.push(ROUTES.WAITING_LOGIN);
      } else if (action === "setup_complete") {
        // Set the auth cookie NOW so the middleware allows the /logged-in route
        setAuthCookie();
        router.push(ROUTES.LOGGED_IN);
      }
    };

    // kiosk_login fires when companion authenticates — store session tokens so
    // API calls work, but do NOT navigate and do NOT set the auth cookie yet.
    // Setting the cookie here would cause the middleware to redirect away from
    // /waiting-login (guestOnly route) before setup_complete fires.
    const loginHandler = (payload: KioskLoginPayload) => {
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
      useAuthStore.setState({
        isAuthenticated: true,
        user: (payload.user as User) ?? null,
      });
    };

    socket.on("kiosk_notification", notificationHandler);
    socket.on("kiosk_login", loginHandler);
    return () => {
      socket.off("kiosk_notification", notificationHandler);
      socket.off("kiosk_login", loginHandler);
    };
  }, [router]);

  return null;
}
