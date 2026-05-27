import { api } from "./api-client";
import type { StandardResponse } from "./api.types";

export interface CosmeticProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  type: string | null;
  tags: string[];
  benefits: string[];
  fileUrl: { fileUrl: string } | null;
}

export interface SkinRecommendation {
  id: string;
  rank: number;
  score: number;
  reason: string;
  cosmeticProduct: CosmeticProduct;
}

export interface SkinAnalysis {
  id: string;
  skinType: string;
  skinTone: string | null;
  hydrationPct: number;
  oilinessPct: number;
  concerns: string[];
  routineTip: string;
  recommendations: SkinRecommendation[];
}

export const cosmeticsService = {
  uploadCapture: async (
    dataUrl: string,
  ): Promise<{ id: string; fileUrl: string }> => {
    const blob = await (await fetch(dataUrl)).blob();
    const form = new FormData();
    form.append("file", blob, "skin-capture.jpg");
    const res = await api.axiosInstance.post(
      "/api/mirror/file-uploads/upload",
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return res.data.data as { id: string; fileUrl: string };
  },

  analyzeSkin: async (fileId: string): Promise<SkinAnalysis> => {
    const res = await api.post<StandardResponse<SkinAnalysis>>(
      "/api/mirror/skin-analyses",
      { fileId, weatherSnapshotId: null },
    );
    if (res.status === 401) throw new Error("401: Unauthorized");
    if (!res.ok || !res.data?.data) throw new Error("Skin analysis failed");
    return res.data.data;
  },

  getAnalysis: async (id: string): Promise<SkinAnalysis> => {
    const res = await api.get<StandardResponse<SkinAnalysis>>(
      `/api/mirror/skin-analyses/${id}`,
    );
    if (!res.ok || !res.data?.data) throw new Error("Not found");
    return res.data.data;
  },

  getProducts: async (params?: {
    tags?: string[];
  }): Promise<{ data: CosmeticProduct[]; total: number }> => {
    const urlParams = new URLSearchParams();
    if (params?.tags) {
      params.tags.forEach((tag) => urlParams.append("tags[]", tag));
    }

    const qs = urlParams.toString();
    const url = `/api/mirror/cosmetic-products${qs ? `?${qs}` : ""}`;

    const res =
      await api.get<
        StandardResponse<{ data: CosmeticProduct[]; total: number }>
      >(url);
    if (!res.ok || !res.data?.data) throw new Error("Failed to fetch products");
    return res.data.data;
  },
};
