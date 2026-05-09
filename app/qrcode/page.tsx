"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { type MirrorKey } from "@/modules/shared/constants/mirrors";

const DEFAULT_MIRROR: MirrorKey =
  (process.env.NEXT_PUBLIC_MIRROR_ID as MirrorKey) ?? "mirror-a";

export default function QrCodePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/qrcode/${DEFAULT_MIRROR}`);
  }, [router]);

  return null;
}
