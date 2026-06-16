import { useQuery } from "@tanstack/react-query";
import {
  chatWonderService,
  type ChatWonderMessageResponse,
} from "@/modules/shared/api/chat-wonder.service";
import { type RemoteGarment } from "@/modules/shared/api/garment.service";
import {
  type RemoteOutfit,
  outfitService,
} from "@/modules/shared/api/outfit.service";

export interface FashionQueryData {
  message: string;
  topsBase: RemoteGarment[];
  topsMid: RemoteGarment[];
  topsOuter: RemoteGarment[];
  bottoms: RemoteGarment[];
  shoes: RemoteGarment[];
  bags: RemoteGarment[];
  outfits: RemoteOutfit[];
}

export function useFashionQuery(
  prompt: string | null,
  weather?: Record<string, unknown> | null,
  category?: string | null,
  gender?: string | null,
  coords?: { lat: number; lon: number } | null,
) {
  return useQuery({
    queryKey: [
      "chatWonder",
      "fashion",
      prompt,
      category,
      gender,
      coords?.lat,
      coords?.lon,
    ],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    queryFn: async (): Promise<FashionQueryData> => {
      if (!prompt) throw new Error("No prompt provided");

      const queryKeyStr = JSON.stringify([
        prompt,
        category,
        gender,
        coords?.lat,
        coords?.lon,
      ]);
      const cacheStr = sessionStorage.getItem("mirror_fashion_current_cache");
      if (cacheStr) {
        try {
          const { key, data } = JSON.parse(cacheStr);
          if (key === queryKeyStr) return data;
        } catch {}
      }

      const payload = {
        input: `[stylist] ${prompt}`,
        pageMode: "garment" as const,
        fsets: 4,
        voice: false,
        ...(weather ? { weather } : {}),
        ...(category ? { category } : {}),
        ...(gender ? { gender } : {}),
        ...(coords ? { location: { lat: coords.lat, lng: coords.lon } } : {}),
      };

      let response: ChatWonderMessageResponse;
      try {
        response = (await chatWonderService.message(
          payload,
        )) as ChatWonderMessageResponse;
      } catch (err) {
        if (err instanceof Error && err.message.includes("HTTP 409")) {
          await chatWonderService.restart();
          response = (await chatWonderService.message(
            payload,
          )) as ChatWonderMessageResponse;
        } else {
          throw err;
        }
      }

      const rawData = response.garment_data as Record<string, unknown> | null;
      const garmentQuery =
        typeof rawData?.query === "string" ? rawData.query : null;

      let fetchedOutfits: RemoteOutfit[] = [];
      if (garmentQuery) {
        let q = garmentQuery.replace(/limit=\d+/, "limit=6");
        if (!q.includes("limit=")) q += "&limit=20";
        fetchedOutfits = await outfitService.getByQuery(q);
      }

      const sets = Array.isArray(rawData?.sets)
        ? (rawData?.sets as Record<string, unknown>[])
        : Array.isArray(rawData?.fsets)
          ? (rawData?.fsets as Record<string, unknown>[])
          : [];

      const newTopsBase: RemoteGarment[] = [];
      const newTopsMid: RemoteGarment[] = [];
      const newTopsOuter: RemoteGarment[] = [];
      const newBottoms: RemoteGarment[] = [];
      const newShoes: RemoteGarment[] = [];
      const newBags: RemoteGarment[] = [];

      const seenItems = new Set<string>();

      function push(
        item: Record<string, unknown>,
        arr: RemoteGarment[],
        fallbackSlot: string,
      ) {
        const iId = String(item.id ?? "");
        if (!iId || seenItems.has(iId)) return;
        seenItems.add(iId);

        arr.push({
          id: iId,
          name: String(item.name ?? ""),
          description: String(item.description ?? ""),
          imageUrl: String(item.imageUrl ?? ""),
          garmentType: Array.isArray(item.garmentType)
            ? (item.garmentType as string[])
            : [],
          fittingSlot: Array.isArray(item.fittingSlot)
            ? (item.fittingSlot as string[])
            : [fallbackSlot],
        } as RemoteGarment);
      }

      for (const s of sets) {
        const recs = Array.isArray(s.recommendations) ? s.recommendations : [];
        for (const r of recs as Record<string, unknown>[]) {
          const garmentType = Array.isArray(r.garmentType)
            ? (r.garmentType as string[])
            : [];
          const fittingSlot = Array.isArray(r.fittingSlot)
            ? (r.fittingSlot as string[])
            : [];
          const layerLevel = String(r.layerLevel || "BASE").toUpperCase();

          if (garmentType.includes("Bag")) {
            push(r, newBags, "RightHandAccessory");
          } else if (fittingSlot.includes("LowerGarment")) {
            push(r, newBottoms, "LowerGarment");
          } else if (fittingSlot.includes("FootGarment")) {
            push(r, newShoes, "FootGarment");
          } else {
            const t = garmentType[0] ?? "";
            if (
              ["Blazer", "Jacket", "Coat", "Parka", "Windbreaker"].includes(
                t,
              ) ||
              layerLevel === "OUTER"
            ) {
              push(r, newTopsOuter, "UpperGarment");
            } else if (
              ["Hoodie", "Sweater", "Cardigan", "Pullover"].includes(t) ||
              layerLevel === "MID"
            ) {
              push(r, newTopsMid, "UpperGarment");
            } else {
              push(r, newTopsBase, "UpperGarment");
            }
          }
        }
      }

      const seenOutfitIds = new Set<string>();
      const newAiOutfits: RemoteOutfit[] = sets
        .filter((s) => s.outfit_imageUrl)
        .map((s, i) => {
          const baseId = String(s.outfit_id ?? `outfit-${i}`);
          const id = seenOutfitIds.has(baseId) ? `${baseId}-${i}` : baseId;
          seenOutfitIds.add(id);
          return {
            id,
            name: String(s.outfit_name ?? "Outfit"),
            description: String(s.reason ?? ""),
            file: { fileUrl: String(s.outfit_imageUrl ?? "") },
            items: ((s.recommendations ?? []) as Record<string, unknown>[]).map(
              (r) => ({
                id: String(r.id ?? crypto.randomUUID()),
                slot: String(
                  (r.fittingSlot as string[])?.[0] ?? "UpperGarment",
                ),
                garment: {
                  id: String(r.id ?? ""),
                  name: String(r.name ?? ""),
                  description: String(r.description ?? ""),
                  imageUrl: String(r.imageUrl ?? ""),
                  garmentType: (r.garmentType as string[]) ?? [],
                  fittingSlot: (r.fittingSlot as string[]) ?? [],
                },
              }),
            ),
            metaData: null,
          };
        });

      // Combine AI-generated outfits (if any) with DB-fetched outfits
      const finalOutfits = [...newAiOutfits, ...fetchedOutfits];

      // Extract garments from DB-fetched outfits too!
      for (const outfit of fetchedOutfits) {
        for (const item of outfit.items) {
          const g = item.garment;
          const garmentType = g.garmentType || [];
          const fittingSlot = g.fittingSlot || [];
          const layerLevel = String(g.layerLevel || "BASE").toUpperCase();

          const garmentRecord = g as unknown as Record<string, unknown>;

          if (garmentType.includes("Bag")) {
            push(garmentRecord, newBags, "RightHandAccessory");
          } else if (fittingSlot.includes("LowerGarment")) {
            push(garmentRecord, newBottoms, "LowerGarment");
          } else if (fittingSlot.includes("FootGarment")) {
            push(garmentRecord, newShoes, "FootGarment");
          } else {
            const t = garmentType[0] ?? "";
            if (
              ["Blazer", "Jacket", "Coat", "Parka", "Windbreaker"].includes(
                t,
              ) ||
              layerLevel === "OUTER"
            ) {
              push(garmentRecord, newTopsOuter, "UpperGarment");
            } else if (
              ["Hoodie", "Sweater", "Cardigan", "Pullover"].includes(t) ||
              layerLevel === "MID"
            ) {
              push(garmentRecord, newTopsMid, "UpperGarment");
            } else {
              push(garmentRecord, newTopsBase, "UpperGarment");
            }
          }
        }
      }

      const finalData = {
        message: response.message ?? "",
        topsBase: newTopsBase,
        topsMid: newTopsMid,
        topsOuter: newTopsOuter,
        bottoms: newBottoms,
        shoes: newShoes,
        bags: newBags,
        outfits: finalOutfits,
      };

      try {
        sessionStorage.setItem(
          "mirror_fashion_current_cache",
          JSON.stringify({ key: queryKeyStr, data: finalData }),
        );
      } catch {}

      return finalData;
    },
    enabled: !!prompt,
  });
}
