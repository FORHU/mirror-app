"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { useOutlineStore } from "@/modules/shared/store/useOutlineStore";
import { useIdleLogout } from "@/modules/shared/hooks/useIdleLogout";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
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
