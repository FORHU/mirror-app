"use client";

import { useEffect, useRef, useState } from "react";
import { getUniversalFaceDetector } from "../utils/faceDetection";

/**
 * useProximitySensor — runs the camera in the background and continuously watches
 * for a face using the browser's native Shape Detection API (`FaceDetector`).
 *
 * It deliberately shows NO visible camera frame. It polls continuously and
 * updates an `isPresent` boolean. It requires several consecutive negative
 * frames to mark `isPresent=false` to prevent flickering.
 *
 * Privacy: nothing is uploaded by this hook. Frames are analyzed locally.
 */

export type TrackerStatus =
  | "starting" // acquiring the camera
  | "searching" // camera live, looking for a face
  | "detected" // a face was found, frame captured
  | "unavailable"; // no camera / permission denied

interface UseProximitySensorOptions {
  /** How often to sample a frame while searching (ms). Default 1000ms. */
  intervalMs?: number;
  /** Number of consecutive negative samples before marking as NOT present. Default 3. */
  missesUntilExit?: number;
}

export function useProximitySensor(options: UseProximitySensorOptions = {}) {
  const { intervalMs = 1000, missesUntilExit = 3 } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<TrackerStatus>("starting");
  const [isPresent, setIsPresent] = useState(false);
  const missesRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const canvas = document.createElement("canvas");
    let detector: any = null;
    getUniversalFaceDetector().then(d => { detector = d; });

    let samples = 0;

    async function sample() {
      if (cancelled) return;

      const video = videoRef.current;
      let found = false;

      if (detector && video && video.videoWidth) {
        try {
          const faces = await detector.detect(video);
          found = Array.isArray(faces) && faces.length > 0;
        } catch {
          found = false;
        }
      }

      if (found) {
        missesRef.current = 0;
        setIsPresent(true);
      } else {
        missesRef.current += 1;
        if (missesRef.current >= missesUntilExit) {
          setIsPresent(false);
        }
      }

      if (!cancelled) {
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
  }, [intervalMs, missesUntilExit]);

  return { videoRef, status, isPresent };
}
