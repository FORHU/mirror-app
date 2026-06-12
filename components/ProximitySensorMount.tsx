"use client";

import { createContext, useContext } from "react";
import { useProximitySensor } from "@/modules/shared/hooks/useProximitySensor";

const CaptureFrameContext = createContext<() => string | null>(() => null);

export function useCaptureFrame() {
  return useContext(CaptureFrameContext);
}

/**
 * Mounts the proximity sensor once at the layout level.
 * Exposes captureFrame via context so any page can grab a JPEG from
 * the already-running camera without opening a second stream.
 */
export function ProximitySensorMount({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { videoRef, captureFrame } = useProximitySensor({ missesUntilExit: 2 });

  return (
    <CaptureFrameContext.Provider value={captureFrame}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-hidden
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          top: 0,
          left: 0,
        }}
      />
      {children}
    </CaptureFrameContext.Provider>
  );
}
