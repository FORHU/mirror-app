"use client";

import { RouteGuard } from "@/modules/shared/components/RouteGuard";

export default function CosmeticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RouteGuard requireAuth>{children}</RouteGuard>;
}
