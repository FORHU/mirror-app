import { useQuery } from "@tanstack/react-query";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";
import { outfitService } from "@/modules/shared/api/outfit.service";
import {
  cosmeticsService,
  type SkinAnalysis,
} from "@/modules/shared/api/cosmetics.service";
import {
  adaptGarmentData,
  adaptRemoteOutfitsToTiles,
  adaptCosmeticsData,
} from "@/modules/overview";

async function fetchOutfitsQuery(
  input: string,
  weather?: Record<string, unknown> | null,
  category?: string | null,
  gender?: string | null,
) {
  // 1. Fetch from ChatWonder
  const payload = {
    input,
    pageMode: "garment" as const,
    set: 4,
    voice: false,
    ...(weather ? { weather } : {}),
    ...(category ? { category } : {}),
    ...(gender ? { gender } : {}),
  };

  let garmentResponse;
  try {
    garmentResponse = await chatWonderService.message(payload);
  } catch (err) {
    if (err instanceof Error && err.message.includes("HTTP 409")) {
      await chatWonderService.restart();
      garmentResponse = await chatWonderService.message(payload);
    } else {
      throw err;
    }
  }

  const rawGarmentData = garmentResponse.garment_data as Record<
    string,
    unknown
  > | null;
  const garmentQuery =
    typeof rawGarmentData?.query === "string" ? rawGarmentData.query : null;

  // 2. Fetch specific items
  if (garmentQuery) {
    let q = garmentQuery.replace(/limit=\d+/, "limit=4");
    if (!q.includes("limit=")) q += "&limit=20";

    const fetchedOutfits = await outfitService.getByQuery(q);
    const shuffled = fetchedOutfits.sort(() => 0.5 - Math.random()).slice(0, 4);
    return adaptRemoteOutfitsToTiles(shuffled);
  }

  return adaptGarmentData(garmentResponse.garment_data);
}

async function fetchCosmeticsQuery(
  input: string,
  weather?: Record<string, unknown> | null,
  skinAnalysis?: SkinAnalysis | null,
) {
  // 1. Fetch from ChatWonder
  const payload = {
    input,
    pageMode: "cosmetics" as const,
    set: 6,
    voice: false,
    ...(weather ? { weather } : {}),
    ...(skinAnalysis ? { skinAnalysis } : {}),
  };

  let cosmeticsResponse;
  try {
    cosmeticsResponse = await chatWonderService.message(payload);
  } catch (err) {
    if (err instanceof Error && err.message.includes("HTTP 409")) {
      await chatWonderService.restart();
      cosmeticsResponse = await chatWonderService.message(payload);
    } else {
      throw err;
    }
  }

  const rawCosmeticsData = cosmeticsResponse.cosmetics_data as Record<
    string,
    unknown
  > | null;
  const cosmeticsIds = Array.isArray(rawCosmeticsData?.ids)
    ? (rawCosmeticsData?.ids as string[])
    : null;
  const cosmeticsQuery =
    typeof rawCosmeticsData?.query === "string" ? rawCosmeticsData.query : null;

  // 2. Fetch specific items
  if (cosmeticsIds?.length) {
    const fetchedProducts = await cosmeticsService.getByIds(cosmeticsIds);
    return adaptCosmeticsData(fetchedProducts);
  } else if (cosmeticsQuery) {
    const cq = new URLSearchParams(cosmeticsQuery);
    if (!cq.has("limit")) cq.set("limit", "6");
    const fetchedProducts = await cosmeticsService.getByQuery(cq.toString());
    return adaptCosmeticsData(fetchedProducts);
  }

  return adaptCosmeticsData(cosmeticsResponse.cosmetics_data);
}

export function useOutfitsQuery(
  prompt: string | null,
  weather?: Record<string, unknown> | null,
  category?: string | null,
  gender?: string | null,
) {
  return useQuery({
    queryKey: ["chatWonder", "outfits", prompt, category, gender],
    queryFn: () => {
      if (!prompt) throw new Error("No prompt provided");
      return fetchOutfitsQuery(prompt, weather, category, gender);
    },
    enabled: !!prompt,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

export function useCosmeticsQuery(
  prompt: string | null,
  weather?: Record<string, unknown> | null,
  skinAnalysis?: SkinAnalysis | null,
) {
  return useQuery({
    queryKey: ["chatWonder", "cosmetics", prompt, skinAnalysis],
    queryFn: () => {
      if (!prompt) throw new Error("No prompt provided");
      return fetchCosmeticsQuery(prompt, weather, skinAnalysis);
    },
    enabled: !!prompt,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
