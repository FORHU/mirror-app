"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(ROUTES.AI_ASSISTANT);
  }, [router]);

  return null;
}
