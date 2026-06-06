"use client";

export type FaceBox = { x: number; y: number; width: number; height: number };

export interface UniversalFaceDetector {
  detect: (image: CanvasImageSource) => Promise<Array<{ boundingBox: FaceBox }>>;
}

let cachedDetector: UniversalFaceDetector | null | undefined = undefined;

export async function getUniversalFaceDetector(): Promise<UniversalFaceDetector | null> {
  if (typeof window === "undefined") return null;
  if (cachedDetector !== undefined) return cachedDetector;

  // 1. Try native FaceDetector API first
  const FD = (window as any).FaceDetector;
  if (FD) {
    try {
      const nativeDetector = new FD({ fastMode: true });
      cachedDetector = nativeDetector;
      return nativeDetector;
    } catch {
      console.warn("Native FaceDetector threw on instantiation. Falling back...");
    }
  }

  // 2. Fallback to TensorFlow.js BlazeFace
  try {
    // Dynamically import tfjs and blazeface to avoid bundling them in the initial load
    const tf = await import("@tensorflow/tfjs");
    await tf.ready();
    const blazeface = await import("@tensorflow-models/blazeface");

    const model = await blazeface.load();

    const fallbackDetector: UniversalFaceDetector = {
      detect: async (image: CanvasImageSource) => {
        // BlazeFace supports HTMLVideoElement, Canvas, etc.
        const predictions = await model.estimateFaces(image as any, false);
        
        return predictions.map((pred: any) => {
          const tl = pred.topLeft as [number, number];
          const br = pred.bottomRight as [number, number];
          return {
            boundingBox: {
              x: tl[0],
              y: tl[1],
              width: br[0] - tl[0],
              height: br[1] - tl[1],
            },
          };
        });
      },
    };

    cachedDetector = fallbackDetector;
    return fallbackDetector;
  } catch (err) {
    console.error("Failed to load UniversalFaceDetector fallback", err);
    cachedDetector = null;
    return null;
  }
}
