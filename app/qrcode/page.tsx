"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { detectMirrorId } from "@/modules/shared/constants/mirrors";

export default function QrCodePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/qrcode/${detectMirrorId()}`);
  }, [router]);

  return null;
}
