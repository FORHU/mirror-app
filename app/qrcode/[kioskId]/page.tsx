"use client";

import { useParams } from "next/navigation";
import { QrCodeView } from "@/components/QrCodeView";
import { MirrorKey } from "@/modules/shared/constants/mirrors";

export default function DynamicQrPage() {
  const params = useParams();
  const kioskId = params.kioskId as MirrorKey;

  return <QrCodeView mirrorKey={kioskId} />;
}
