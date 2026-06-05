"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { useOutlineStore } from "@/modules/shared/store/useOutlineStore";
import { installKioskAuth } from "@/modules/shared/utils/install-kiosk-auth";

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Install the kiosk's hostname-keyed JWT before _init runs so api-client
    // has a bearer token even for direct deep-links (e.g. reloading /map).
    installKioskAuth()
      .then(() => useAuthStore.getState()._init())
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

  return <>{children}</>;
}
