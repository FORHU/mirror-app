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

async function fetchOverviewData(
  input: string,
  weather?: Record<string, unknown> | null,
  category?: string | null,
  gender?: string | null,
  skinAnalysis?: SkinAnalysis | null,
  coords?: { lat: number; lon: number } | null,
) {
  // 1. Fetch from ChatWonder
  const payload = {
    input,
    pageMode: "overview" as const,
    fsets: 4,
    csets: 4,
    voice: false,
    ...(weather ? { weather } : {}),
    ...(category ? { category } : {}),
    ...(gender ? { gender } : {}),
    ...(skinAnalysis ? { skinAnalysis } : {}),
    ...(coords ? { location: { lat: coords.lat, lng: coords.lon } } : {}),
  };

  let response;
  try {
    response = await chatWonderService.message(payload);
  } catch (err) {
    if (err instanceof Error && err.message.includes("HTTP 409")) {
      await chatWonderService.restart();
      response = await chatWonderService.message(payload);
    } else {
      throw err;
    }
  }

  const rawGarmentData = response.garment_data as Record<
    string,
    unknown
  > | null;
  const garmentQuery =
    typeof rawGarmentData?.query === "string" ? rawGarmentData.query : null;

  const rawCosmeticsData = response.cosmetics_data as Record<
    string,
    unknown
  > | null;
  const cosmeticsQuery =
    typeof rawCosmeticsData?.query === "string" ? rawCosmeticsData.query : null;

  // 2. Fetch specific items in parallel if AI provided DB queries
  const fetchPromises = [
    (async () => {
      if (garmentQuery) {
        let q = garmentQuery.replace(/limit=\d+/, "limit=4");
        if (!q.includes("limit=")) q += "&limit=20";
        const fetchedOutfits = await outfitService.getByQuery(q);
        const shuffled = fetchedOutfits
          .sort(() => 0.5 - Math.random())
          .slice(0, 4);
        return adaptRemoteOutfitsToTiles(shuffled);
      }
      return adaptGarmentData(response.garment_data);
    })(),
    (async () => {
      if (cosmeticsQuery) {
        const cq = new URLSearchParams(cosmeticsQuery);
        if (!cq.has("limit")) cq.set("limit", "4");
        const fetchedProducts = await cosmeticsService.getByQuery(
          cq.toString(),
        );
        return adaptCosmeticsData(fetchedProducts);
      }
      return adaptCosmeticsData(response.cosmetics_data);
    })(),
  ];

  const [outfits, cosmetics] = await Promise.all([
    fetchPromises[0] as Promise<ReturnType<typeof adaptGarmentData>>,
    fetchPromises[1] as Promise<ReturnType<typeof adaptCosmeticsData>>,
  ]);

  return { outfits, cosmetics };
}

export function useOverviewDataQuery(
  prompt: string | null,
  weather?: Record<string, unknown> | null,
  category?: string | null,
  gender?: string | null,
  skinAnalysis?: SkinAnalysis | null,
  coords?: { lat: number; lon: number } | null,
) {
  return useQuery({
    queryKey: [
      "chatWonder",
      "overview",
      prompt,
      category,
      gender,
      skinAnalysis,
    ],
    queryFn: () => {
      if (!prompt) throw new Error("No prompt provided");
      return fetchOverviewData(
        prompt,
        weather,
        category,
        gender,
        skinAnalysis,
        coords,
      );
    },
    enabled: !!prompt,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
