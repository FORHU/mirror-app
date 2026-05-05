"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize the store from storage on mount
    useAuthStore.getState()._init();
  }, []);

  return <>{children}</>;
}
