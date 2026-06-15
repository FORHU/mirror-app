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
  details: string | null;
  metaData: Record<string, unknown> | null;
  hexColor: string | null;
  priceAmount: number | null;
  priceUnit: string | null;
  spf: number | null;
  waterproof: boolean;
  hydrating: boolean;
  oilFree: boolean;
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
  getByQuery: async (queryString: string): Promise<CosmeticProduct[]> => {
    const res = await api.get<
      StandardResponse<{ items: CosmeticProduct[] } | CosmeticProduct[]>
    >(`/api/mirror/cosmetic-products?${queryString}`);
    if (!res.ok)
      throw new Error(res.problem ?? "Failed to fetch cosmetic products");
    const data = res.data?.data;
    const items = Array.isArray(data)
      ? data
      : Array.isArray((data as { items?: CosmeticProduct[] })?.items)
        ? (data as { items: CosmeticProduct[] }).items
        : null;
    if (!items) throw new Error("Unexpected response shape");
    return items;
  },

  getPage: async (
    page: number,
    limit = 100,
  ): Promise<{ items: CosmeticProduct[]; hasMore: boolean }> => {
    const res = await api.get<
      StandardResponse<{ items: CosmeticProduct[] } | CosmeticProduct[]>
    >(`/api/mirror/cosmetic-products?page=${page}&limit=${limit}`);
    if (!res.ok)
      throw new Error(res.problem ?? "Failed to fetch cosmetic products");
    const data = res.data?.data;
    const items = Array.isArray(data)
      ? data
      : Array.isArray((data as { items?: CosmeticProduct[] })?.items)
        ? (data as { items: CosmeticProduct[] }).items
        : null;
    if (items === null) throw new Error("Unexpected response shape");
    return { items, hasMore: items.length >= limit };
  },

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

  // Kicks off the async analysis. The backend answers 202 ("started") and
  // pushes the finished result over Socket.io (skin_analysis_complete), so we
  // do NOT expect data in this response — only confirm the job was accepted.
  startSkinAnalysis: async (fileId: string): Promise<void> => {
    const res = await api.post<StandardResponse<unknown>>(
      "/api/mirror/skin-analyses",
      { fileId, weatherSnapshotId: null },
    );
    if (res.status === 401) throw new Error("401: Unauthorized");
    // 202 Accepted is the happy path; anything outside 2xx is a real failure.
    if (!res.ok) {
      throw new Error(
        (res.data as { message?: string })?.message ??
          "Failed to start skin analysis",
      );
    }
  },
};
