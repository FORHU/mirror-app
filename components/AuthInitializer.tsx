"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (BYPASS_AUTH) {
      useAuthStore.setState({ isLoading: false, isAuthenticated: true });
      return;
    }
    useAuthStore.getState()._init();
  }, []);

  return <>{children}</>;
}
