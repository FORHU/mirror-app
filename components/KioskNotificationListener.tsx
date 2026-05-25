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
      } else if (action === "profile_updated") {
        // Gender setup complete on companion — set auth cookie so the middleware
        // allows /logged-in (protected route), then navigate there.
        setAuthCookie();
        router.push(ROUTES.LOGGED_IN);
      } else if (action === "force_logout") {
        useAuthStore.getState().logout({ isRemote: true }).then(() => {
          router.push(ROUTES.WELCOME);
        });
      }
    };

    // kiosk_login fires when companion authenticates — store session tokens so
    // API calls work, but do NOT navigate and do NOT set the auth cookie yet.
    // Setting the cookie here would cause the middleware to redirect away from
    // /waiting-login (guestOnly route) before setup_complete fires.
    //
    // Two payload shapes arrive on this event:
    //  1. { accessToken, refreshToken, user: { id, email, username } }  — login / pairMirror
    //  2. Raw Prisma User { id, email, username, gender, … }            — updateProfile (no tokens)
    const loginHandler = (payload: KioskLoginPayload) => {
      if (payload?.accessToken) {
        setCachedAccessToken(payload.accessToken);
        setStorageData(ACCESS_TOKEN, payload.accessToken);
      }
      if (payload?.refreshToken) {
        setStorageData(REFRESH_TOKEN, payload.refreshToken);
      }

      const nested = payload?.user as User | undefined;
      const raw = !nested && (payload as unknown as User)?.id
        ? (payload as unknown as User)
        : undefined;
      const user = nested ?? raw ?? null;

      if (user) {
        setStorageData(USER, user);
        useAuthStore.setState({ isAuthenticated: true, user });
      } else {
        // Payload carries no user data — mark authenticated but preserve existing user
        useAuthStore.setState({ isAuthenticated: true });
      }
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
