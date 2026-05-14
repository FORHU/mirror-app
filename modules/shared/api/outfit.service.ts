import { api } from "./api-client";

export interface OutfitItem {
  garmentId: string;
  slot?: string;
}

export interface CreateOutfitParams {
  name: string;
  items: OutfitItem[];
  pngBlob?: Blob | null;
  isPublic?: boolean;
}

export const outfitService = {
  create: async ({ name, items, pngBlob, isPublic = false }: CreateOutfitParams): Promise<void> => {
    const form = new FormData();
    form.append("name", name);
    form.append("items", JSON.stringify(items));
    form.append("isPublic", String(isPublic));
    if (pngBlob) {
      form.append("file", pngBlob, "outfit.png");
    }
    await api.axiosInstance.post("/remote/outfits", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
