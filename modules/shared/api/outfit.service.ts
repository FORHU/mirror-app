import { api } from "./api-client";
import type { StandardResponse } from "./api.types";

export interface OutfitItem {
  garmentId: string;
  slot?: string;
}

export interface RemoteOutfitGarment {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  garmentType: string[];
  fittingSlot: string[];
}

export interface RemoteOutfitItem {
  id: string;
  slot: string;
  garment: RemoteOutfitGarment;
}

export interface RemoteOutfit {
  id: string;
  name: string;
  description: string | null;
  file: { fileUrl: string };
  items: RemoteOutfitItem[];
  metaData: { category: string; categoryMix: Record<string, number> } | null;
}

export interface CreateOutfitParams {
  name: string;
  items: OutfitItem[];
  pngBlob?: Blob | null;
  isPublic?: boolean;
}

export interface CreatedOutfit {
  id: string;
  name: string;
  [key: string]: unknown;
}

export const outfitService = {
  getAll: async (page?: number, limit?: number): Promise<RemoteOutfit[]> => {
    const params = new URLSearchParams();
    if (page) params.set("page", String(page));
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    const response = await api.get<StandardResponse<{ items: RemoteOutfit[] }>>(
      `/api/mirror/outfits${qs ? `?${qs}` : ""}`,
    );
    if (!response.ok) {
      throw new Error(response.problem ?? "Failed to fetch outfits");
    }
    const items = response.data?.data?.items;
    if (Array.isArray(items)) return items;
    throw new Error("Unexpected response shape");
  },

  getByQuery: async (queryString: string): Promise<RemoteOutfit[]> => {
    const response = await api.get<StandardResponse<{ items: RemoteOutfit[] }>>(
      `/api/mirror/outfits?${queryString}`,
    );
    if (!response.ok) {
      throw new Error(response.problem ?? "Failed to fetch outfits");
    }
    const items = response.data?.data?.items;
    if (Array.isArray(items)) return items;
    throw new Error("Unexpected response shape");
  },

  create: async ({
    name,
    items,
    pngBlob,
    isPublic = false,
  }: CreateOutfitParams): Promise<CreatedOutfit> => {
    const form = new FormData();
    form.append("name", name);
    form.append("items", JSON.stringify(items));
    form.append("isPublic", String(isPublic));
    if (pngBlob) {
      form.append("file", pngBlob, "outfit.png");
    }
    const res = await api.axiosInstance.post("/api/mirror/outfits", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data as CreatedOutfit;
  },
};
