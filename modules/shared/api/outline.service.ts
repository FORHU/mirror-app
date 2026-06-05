import { api } from "@/modules/shared/api/api-client";

export interface OutlineEvent {
  id: string;
  type: string;
  timeBlock: string;
  routeDestination: string | null;
  routeOrigin: string | null;
}

export interface Outline {
  id: string;
  userId: string;
  userPrompt: string[];
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  startTime: string | null;
  createdAt: string;
  events: OutlineEvent[];
}

export const outlineService = {
  async getActive(): Promise<Outline | null> {
    const res = await api.get<{ data: Outline | null }>(
      "/api/mirror/outlines/active",
    );
    return res.data?.data ?? null;
  },

  async create(): Promise<Outline> {
    const res = await api.post<{ data: Outline }>("/api/mirror/outlines", {});
    if (!res.data?.data) throw new Error("Failed to create outline");
    return res.data.data;
  },

  async getOrCreate(): Promise<Outline> {
    const active = await outlineService.getActive();
    if (active) return active;
    return outlineService.create();
  },

  /**
   * RESET — clears the user's itinerary (soft-deletes all active outlines) so a
   * page refresh starts clean. Returns the number of outlines cleared.
   */
  async reset(): Promise<number> {
    const res = await api.post<{ data: { cleared: number } }>(
      "/api/mirror/outlines/reset",
      {},
    );
    return res.data?.data?.cleared ?? 0;
  },
};
