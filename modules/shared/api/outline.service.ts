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

  async saveMapStops(
    stops: Array<{
      name: string;
      lat: number;
      lng: number;
      address?: string;
      eventType?: string;
      timeBlock?: string;
    }>,
  ): Promise<void> {
    await api.post("/api/mirror/outlines/map-stops", { stops });
  },

  /**
   * RESET — without a scope, soft-deletes all active outlines (full wipe, used by
   * Restart). With a scope, clears only that feature's contribution to the active
   * outline (the per-screen Reset). Returns the number of rows cleared.
   */
  async reset(scope?: "fashion" | "cosmetic" | "itinerary"): Promise<number> {
    const res = await api.post<{ data: { cleared: number } }>(
      "/api/mirror/outlines/reset",
      scope ? { scope } : {},
    );
    return res.data?.data?.cleared ?? 0;
  },
};
