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

  // Full product catalog; skin-type filtering happens on the frontend
  // (see modules/cosmetics/constants.ts SKIN_TYPE_FILTERS).
  // The endpoint is paginated, so we walk every page until a short page
  // signals the end (a missing-pagination backend returns everything in one).
  getAllProducts: async (): Promise<CosmeticProduct[]> => {
    const limit = 100;
    const maxPages = 50; // safety valve against a backend that ignores paging
    const all: CosmeticProduct[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const res = await api.get<
        StandardResponse<{ items: CosmeticProduct[] } | CosmeticProduct[]>
      >(`/api/mirror/cosmetic-products?page=${page}&limit=${limit}`);
      if (!res.ok) {
        throw new Error(res.problem ?? "Failed to fetch cosmetic products");
      }
      const data = res.data?.data;
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : null;
      if (items === null) throw new Error("Unexpected response shape");
      all.push(...items);
      if (items.length < limit) break;
    }
    return all;
  },

  getByIds: async (ids: string[]): Promise<unknown[]> => {
    const res = await api.post<StandardResponse<unknown[]>>(
      "/api/mirror/cosmetic-products/batch",
      { ids },
    );
    if (!res.ok)
      throw new Error(res.problem ?? "Failed to fetch cosmetic products by id");
    return Array.isArray(res.data?.data) ? res.data.data : [];
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
