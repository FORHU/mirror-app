import { api } from "./api-client";

export const tryOnModelService = {
  uploadModel: async (dataUrl: string): Promise<void> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const form = new FormData();
    form.append("file", blob, "model.jpg");

    await api.axiosInstance.post("api/mirror/try-on/model", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export interface TryOnRunResult {
  id?: string;
  predictionId?: string;
  status?: string;
  output?: string | string[];
  imageUrl?: string;
  fileId?: string;
  media?: "image" | "video";
  [key: string]: unknown;
}

export interface TryOnStatusResult {
  predictionId: string;
  predictionStatus: "starting" | "processing" | "completed" | "failed";
  outputUrl: string | null;
  error: string | null;
}

export interface TryOnByImagesParams {
  modelImage: string;
  outfitImage: string;
  category: string;
}

export const tryOnService = {
  runByOutfit: async (
    outfitId: string,
    kioskId?: string,
  ): Promise<TryOnRunResult> => {
    const body: Record<string, string> = { outfitId };
    if (kioskId) body.kioskId = kioskId;
    const res = await api.axiosInstance.post("/api/mirror/try-on/outfit", body);
    return res.data.data as TryOnRunResult;
  },

  runByImages: async (params: TryOnByImagesParams): Promise<string> => {
    const res = await api.axiosInstance.post("/api/mirror/try-on/run", {
      ...params,
      prompt:
        "Use the modelImage strictly as the positional and fitting reference for garment placement. The modelImage contains a black mannequin that defines the exact (x, y) coordinates, spacing, scale, proportions, layering order, and garment arrangement for the final composition. Fit the garments from the outfitImage precisely onto the black mannequin areas shown in the modelImage, ensuring that each garment aligns naturally and accurately within its intended position. Preserve the original garment design exactly as provided in the outfitImage, including textures, colors, logos, stitching, graphics, folds, proportions, and orientation. Do not randomly reposition, rotate, redesign, reinterpret, or disproportionately resize any garment. Maintain the original front-facing direction and ensure all garments follow the exact layout structure defined by the black mannequin in the modelImage. Once all garments are placed, remove the black mannequin entirely so that only the clothing items remain, presented as a ghost mannequin or invisible mannequin effect. The final output should appear as a clean professional fashion catalog or e-commerce mockup with a neutral studio background.",
    });
    const predictionId: string = res.data?.data?.predictionId;
    if (!predictionId) throw new Error("Try-on failed — no predictionId returned");
    return predictionId;
  },

  getStatus: async (predictionId: string): Promise<TryOnStatusResult> => {
    const res = await api.axiosInstance.get(
      `/api/mirror/try-on/${predictionId}/status`,
    );
    const data = res.data?.data;
    if (!data) throw new Error("Invalid status response");
    return data as TryOnStatusResult;
  },
};
