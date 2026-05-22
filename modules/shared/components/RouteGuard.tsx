"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { AppLoader } from "./AppLoader";

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

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
      router.replace("/");
    }

    if (
      !requireAuth &&
      isAuthenticated &&
      (pathname === "/" || pathname.startsWith("/onboarding"))
    ) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, requireAuth, router, pathname]);

  if (BYPASS_AUTH) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <AppLoader />
      </div>
    );
  }

  return <>{children}</>;
}
