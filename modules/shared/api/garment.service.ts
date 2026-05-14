import { api } from "./api-client";
import type { FittingSlot } from "@/modules/garment/types";

export interface RemoteGarmentFile {
  id: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  mimeType: string;
  originalName: string;
}

export interface RemoteGarment {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  fittingSlot: string[];
  garmentType: string[];
  category: string[];
  file: RemoteGarmentFile | null;
}

export const garmentService = {
  getBySlot: async (fittingSlot: FittingSlot): Promise<RemoteGarment[]> => {
    const response = await api.get<any>("/api/remote/garments", { fittingSlot });
    if (!response.ok) {
      throw new Error(response.problem ?? "Failed to fetch garments");
    }
    // Actual shape: { status, data: { data: [...], total, page, limit } }
    const garments = response.data?.data?.data;
    if (Array.isArray(garments)) return garments;
    throw new Error("Unexpected response shape");
  },
};
