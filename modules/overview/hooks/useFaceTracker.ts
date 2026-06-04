"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useFaceTracker — runs the (eMeet) camera in the background and watches for a
 * face using the browser's native Shape Detection API (`FaceDetector`), the
 * same detector the cosmetics capture flow uses.
 *
 * It deliberately shows NO visible camera frame — the <video> is attached
 * off-screen purely so frames can be sampled. On the first confident detection
 * it grabs one JPEG frame and hands it to `onDetect` (used to kick off the
 * background skin analysis), then stops sampling.
 *
 * Privacy: nothing is uploaded by this hook. The single captured frame is
 * passed to the caller, which owns whether/where it goes.
 */

type FaceDetectorCtor = new (opts?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => { detect: (i: CanvasImageSource) => Promise<unknown[]> };

function getFaceDetector(): FaceDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector ??
    null
  );
}

export type TrackerStatus =
  | "starting" // acquiring the camera
  | "searching" // camera live, looking for a face
  | "detected" // a face was found, frame captured
  | "unavailable"; // no camera / permission denied

interface UseFaceTrackerOptions {
  /** How often to sample a frame while searching (ms). */
  intervalMs?: number;
  /** Fires exactly once with a captured JPEG data URL when a face is found. */
  onDetect?: (frameDataUrl: string) => void;
  /**
   * If `FaceDetector` is unavailable, proceed after this many samples so the
   * experience still flows on unsupported browsers. Set to 0 to never fall back.
   */
  fallbackAfterSamples?: number;
}

export function useFaceTracker(options: UseFaceTrackerOptions = {}) {
  const { intervalMs = 1200, onDetect, fallbackAfterSamples = 4 } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onDetectRef = useRef(onDetect);
  const firedRef = useRef(false);

  const [status, setStatus] = useState<TrackerStatus>("starting");

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const canvas = document.createElement("canvas");
    const detector = (() => {
      const FD = getFaceDetector();
      try {
        return FD ? new FD({ fastMode: true, maxDetectedFaces: 1 }) : null;
      } catch {
        return null;
      }
    })();

    let samples = 0;

    function captureFrame(): string | null {
      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight) return null;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        return canvas.toDataURL("image/jpeg", 0.9);
      } catch {
        return null;
      }
    }

    function fire(frame: string) {
      if (firedRef.current || cancelled) return;
      firedRef.current = true;
      setStatus("detected");
      onDetectRef.current?.(frame);
    }

    async function sample() {
      if (cancelled || firedRef.current) return;
      samples += 1;

      const video = videoRef.current;
      let found: boolean | null = null;

      if (detector && video && video.videoWidth) {
        try {
          const faces = await detector.detect(video);
          found = Array.isArray(faces) && faces.length > 0;
        } catch {
          found = null; // detector hiccup — treat as inconclusive
        }
      }

      if (found === true) {
        const frame = captureFrame();
        if (frame) {
          fire(frame);
          return;
        }
      }

      // Graceful fallback: detector unavailable/inconclusive for too long.
      const detectorUseless = detector === null || found === null;
      if (
        detectorUseless &&
        fallbackAfterSamples > 0 &&
        samples >= fallbackAfterSamples
      ) {
        const frame = captureFrame();
        if (frame) {
          fire(frame);
          return;
        }
      }

      if (!cancelled && !firedRef.current) {
        timer = setTimeout(sample, intervalMs);
      }
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setStatus("searching");
        timer = setTimeout(sample, intervalMs);
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [intervalMs, fallbackAfterSamples]);

  return { videoRef, status };
}
