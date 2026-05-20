import { api } from "@/modules/shared/api/api-client";

export interface Outline {
  id: string;
  userId: string;
  userPrompt: string[];
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  startTime: string | null;
  createdAt: string;
}

export const outlineService = {
  async getActive(): Promise<Outline | null> {
    const res = await api.get<{ data: Outline | null }>("/api/remote/outlines/active");
    return res.data?.data ?? null;
  },

  async create(): Promise<Outline> {
    const res = await api.post<{ data: Outline }>("/api/remote/outlines", {});
    if (!res.data?.data) throw new Error("Failed to create outline");
    return res.data.data;
  },

  async getOrCreate(): Promise<Outline> {
    const active = await outlineService.getActive();
    if (active) return active;
    return outlineService.create();
  },
};
