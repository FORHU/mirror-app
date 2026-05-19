"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { useIdleLogout } from "@/modules/shared/hooks/useIdleLogout";

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (BYPASS_AUTH) {
      useAuthStore.setState({ isLoading: false, isAuthenticated: true });
      return;
    }
    useAuthStore.getState()._init();
  }, []);

  // Auto-logout after 5 min of inactivity; releases the kiosk lock too.
  // Self-disables when not authenticated.
  useIdleLogout();

  return <>{children}</>;
}
