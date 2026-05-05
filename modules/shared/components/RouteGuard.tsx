"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { AppLoader } from "./AppLoader";

interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function RouteGuard({ children, requireAuth = true }: RouteGuardProps) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (requireAuth && !isAuthenticated) {
      router.replace("/auth");
    }

    if (
      !requireAuth &&
      isAuthenticated &&
      (pathname === "/" ||
        pathname.startsWith("/auth") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/verify-email") ||
        pathname.startsWith("/onboarding"))
    ) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, requireAuth, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <AppLoader />
      </div>
    );
  }

  return <>{children}</>;
}
