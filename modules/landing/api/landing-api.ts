import { api } from "@/modules/shared/api/api-client";
import { ApiResult } from "@/modules/shared/api/api.types";

export interface LandingStats {
  activeMembers: string;
  circles: string;
  liveEvents: string;
  satisfaction: string;
}

export const landingApi = {
  getStats: (): Promise<ApiResult<LandingStats>> => api.get("/landing/stats"),

  getFeatures: (): Promise<ApiResult<Record<string, unknown>[]>> =>
    api.get("/landing/features"),
};
