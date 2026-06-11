"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useFaceAlignment — runs the front camera as a LIVE preview and continuously
 * checks whether the user's face is centered and close enough using the
 * browser's native Shape Detection API (`FaceDetector`).
 *
 * Unlike the older silent capture flow, this hook is meant to be shown to the
 * user: attach `videoRef` to a visible <video> and use `state` / `progress` to
 * drive on-screen guidance ("move closer", "center your face", "hold still…").
 *
 * When the face stays aligned for `holdMs`, a single JPEG frame is grabbed and
 * handed to `onCapture`. If `FaceDetector` is unavailable, the preview still
 * shows and a frame is captured after `fallbackMs` so the flow never stalls.
 */

import {
  getUniversalFaceDetector,
  type UniversalFaceDetector,
  type FaceBox,
} from "../utils/faceDetection";

export type AlignState =
  | "starting" // acquiring the camera
  | "unavailable" // no camera / permission denied
  | "searching" // camera live, detector warming up
  | "no-face" // nobody in frame
  | "too-far" // face too small — move closer
  | "too-close" // face too large — move back
  | "off-center" // face present but not centered
  | "aligned" // centered & close enough — holding to capture
  | "captured"; // frame grabbed

interface UseFaceAlignmentOptions {
  /** Called once with a JPEG data URL when the face has held alignment. */
  onCapture: (dataUrl: string) => void;
  /** How long (ms) the face must stay aligned before capture. */
  holdMs?: number;
  /** Detection cadence (ms). */
  intervalMs?: number;
  /** Min face width as a fraction of frame width (smaller ⇒ "too far"). */
  minSize?: number;
  /** Max face width as a fraction of frame width (larger ⇒ "too close"). */
  maxSize?: number;
  /** Allowed center offset from frame center, as a fraction (0–0.5). */
  centerTol?: number;
  /** Vertical target for the face center (0 top … 1 bottom). */
  targetY?: number;
  /** If FaceDetector is unavailable, capture after this many ms anyway. */
  fallbackMs?: number;
}

export function useFaceAlignment({
  onCapture,
  holdMs = 900,
  intervalMs = 180,
  minSize = 0.34,
  maxSize = 0.82,
  centerTol = 0.18,
  targetY = 0.46,
  fallbackMs = 6000,
}: UseFaceAlignmentOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onCaptureRef = useRef(onCapture);
  const capturedRef = useRef(false);

  const [state, setState] = useState<AlignState>("starting");
  // 0–1 hold progress while aligned, used to drive a capture ring.
  const [progress, setProgress] = useState(0);
  // Bump to restart the camera (used by a "Try again" button on error).
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  const retry = useCallback(() => {
    capturedRef.current = false;
    setProgress(0);
    setState("starting");
    setRunId((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alignedSince: number | null = null;
    const startedAt = Date.now();

    const canvas = document.createElement("canvas");
    let detector: UniversalFaceDetector | null = null;
    getUniversalFaceDetector().then((d) => {
      detector = d;
    });
    let primaryBox: FaceBox | null = null;

    function grabFrame(): string | null {
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

    function fire() {
      if (capturedRef.current || cancelled) return;
      const frame = grabFrame();
      if (!frame) return;
      capturedRef.current = true;
      setState("captured");
      setProgress(1);
      onCaptureRef.current(frame);
    }

    // Classify the current frame and update guidance state. Returns whether the
    // face is currently aligned (centered + correctly sized).
    async function classify(): Promise<boolean> {
      const video = videoRef.current;
      if (!detector || !video || !video.videoWidth) {
        // No detector: stay in a neutral "searching" state and rely on the
        // fallback timer below.
        setState("searching");
        return false;
      }

      let box: FaceBox | null = null;
      try {
        const faces = await detector.detect(video);
        if (!faces || faces.length === 0) {
          box = null;
          primaryBox = null; // lost lock
        } else {
          if (!primaryBox) {
            // Pick largest initially
            faces.sort(
              (a: { boundingBox: FaceBox }, b: { boundingBox: FaceBox }) =>
                b.boundingBox.width * b.boundingBox.height -
                a.boundingBox.width * a.boundingBox.height,
            );
            primaryBox = faces[0].boundingBox;
          } else {
            // Find closest to current lock
            const px = primaryBox.x + primaryBox.width / 2;
            const py = primaryBox.y + primaryBox.height / 2;
            faces.sort(
              (a: { boundingBox: FaceBox }, b: { boundingBox: FaceBox }) => {
                const cxA = a.boundingBox.x + a.boundingBox.width / 2;
                const cyA = a.boundingBox.y + a.boundingBox.height / 2;
                const distA = Math.hypot(cxA - px, cyA - py);
                const cxB = b.boundingBox.x + b.boundingBox.width / 2;
                const cyB = b.boundingBox.y + b.boundingBox.height / 2;
                const distB = Math.hypot(cxB - px, cyB - py);
                return distA - distB;
              },
            );
            primaryBox = faces[0].boundingBox;
          }
          box = primaryBox;
        }
      } catch {
        box = null; // detector hiccup — treat as no face this tick
      }

      if (!box) {
        setState("no-face");
        return false;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const sizeRatio = box.width / vw;
      const cx = (box.x + box.width / 2) / vw;
      const cy = (box.y + box.height / 2) / vh;

      if (sizeRatio < minSize) {
        setState("too-far");
        return false;
      }
      if (sizeRatio > maxSize) {
        setState("too-close");
        return false;
      }
      if (
        Math.abs(cx - 0.5) > centerTol ||
        Math.abs(cy - targetY) > centerTol
      ) {
        setState("off-center");
        return false;
      }

      setState("aligned");
      return true;
    }

    async function tick() {
      if (cancelled || capturedRef.current) return;

      const aligned = await classify();
      if (cancelled || capturedRef.current) return;

      const now = Date.now();
      if (aligned) {
        if (alignedSince === null) alignedSince = now;
        const held = now - alignedSince;
        setProgress(Math.min(1, held / holdMs));
        if (held >= holdMs) {
          fire();
          return;
        }
      } else {
        alignedSince = null;
        setProgress(0);
        // Fallback for browsers without FaceDetector: capture after a while so
        // the experience still completes, using the live frame on screen.
        if (!detector && fallbackMs > 0 && now - startedAt >= fallbackMs) {
          fire();
          return;
        }
      }

      timer = setTimeout(tick, intervalMs);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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
        setState("searching");
        timer = setTimeout(tick, intervalMs);
      } catch {
        if (!cancelled) setState("unavailable");
      }
    }

    start();

    const videoEl = videoRef.current;
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoEl) videoEl.srcObject = null;
    };
  }, [
    runId,
    holdMs,
    intervalMs,
    minSize,
    maxSize,
    centerTol,
    targetY,
    fallbackMs,
  ]);

  return { videoRef, state, progress, retry };
}
