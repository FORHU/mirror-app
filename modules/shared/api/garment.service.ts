import { api } from "./api-client";
import type { StandardResponse } from "./api.types";
import type { FittingSlot } from "@/modules/garment/types";

export interface RemoteGarmentFile {
  id: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  mimeType: string;
  originalName: string;
}

export interface RemoteGarmentTag {
  id: string;
  name: string;
}

export interface RemoteGarment {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  fittingSlot: string[];
  garmentType: string[];
  category: string[];
  tags: RemoteGarmentTag[];
  gender: string | null;
  silhouette: string | null;
  layerLevel: string | null;
  file: RemoteGarmentFile | null;
}

export const garmentService = {
  getBySlot: async (fittingSlot: FittingSlot): Promise<RemoteGarment[]> => {
    const response = await api.get<
      StandardResponse<{ items: RemoteGarment[] }>
    >("/api/mirror/garments", {
      fittingSlot,
    });
    if (!response.ok) {
      throw new Error(response.problem ?? "Failed to fetch garments");
    }
    const garments = response.data?.data?.items;
    if (Array.isArray(garments)) return garments;
    throw new Error("Unexpected response shape");
  },

  getBySlotAndType: async (
    fittingSlot: FittingSlot,
    garmentType: string,
  ): Promise<RemoteGarment[]> => {
    const response = await api.get<
      StandardResponse<{ items: RemoteGarment[] }>
    >("/api/mirror/garments", {
      fittingSlot,
      garmentType,
    });
    if (!response.ok) {
      throw new Error(response.problem ?? "Failed to fetch garments");
    }
    const garments = response.data?.data?.items;
    if (Array.isArray(garments)) return garments;
    throw new Error("Unexpected response shape");
  },
};
