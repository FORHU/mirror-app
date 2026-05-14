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
  status?: string;
  output?: string | string[];
  imageUrl?: string;
  [key: string]: unknown;
}

export const tryOnService = {
  runByOutfit: async (outfitId: string, kioskId?: string): Promise<TryOnRunResult> => {
    const body: Record<string, string> = { outfitId };
    if (kioskId) body.kioskId = kioskId;
    const res = await api.axiosInstance.post("/api/mirror/try-on/outfit", body);
    return res.data.data as TryOnRunResult;
  },
};
