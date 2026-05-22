"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { useOutlineStore } from "@/modules/shared/store/useOutlineStore";
import { useIdleLogout } from "@/modules/shared/hooks/useIdleLogout";

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (BYPASS_AUTH) {
      useAuthStore.setState({ isLoading: false, isAuthenticated: true });
      useOutlineStore.getState().init();
      return;
    }
    useAuthStore
      .getState()
      ._init()
      .then(() => {
        if (useAuthStore.getState().isAuthenticated) {
          useOutlineStore.getState().init();
        }
      });
  }, []);

  // Reset outline when user logs out
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useEffect(() => {
    if (!isAuthenticated) useOutlineStore.getState().reset();
  }, [isAuthenticated]);

  // Auto-logout after 5 min of inactivity; releases the kiosk lock too.
  // Self-disables when not authenticated.
  useIdleLogout();

  return <>{children}</>;
}
