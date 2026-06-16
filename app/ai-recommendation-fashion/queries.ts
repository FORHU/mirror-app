import { useQuery } from "@tanstack/react-query";
import {
  chatWonderService,
  type ChatWonderMessageResponse,
} from "@/modules/shared/api/chat-wonder.service";
import { type SkinAnalysis } from "@/modules/shared/api/cosmetics.service";
import { type RemoteGarment } from "@/modules/shared/api/garment.service";
import { type RemoteOutfit } from "@/modules/shared/api/outfit.service";

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
  skinAnalysis?: SkinAnalysis | null,
  coords?: { lat: number; lon: number } | null,
) {
  return useQuery({
    queryKey: ["chatWonder", "fashion", prompt, category, gender, skinAnalysis],
    queryFn: async (): Promise<FashionQueryData> => {
      if (!prompt) throw new Error("No prompt provided");

      const payload = {
        input: `[stylist] ${prompt}`,
        pageMode: "garment" as const,
        fsets: 6,
        voice: false,
        ...(weather ? { weather } : {}),
        ...(category ? { category } : {}),
        ...(gender ? { gender } : {}),
        ...(skinAnalysis ? { skinAnalysis } : {}),
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

      return {
        message: response.message ?? "",
        topsBase: newTopsBase,
        topsMid: newTopsMid,
        topsOuter: newTopsOuter,
        bottoms: newBottoms,
        shoes: newShoes,
        bags: newBags,
        outfits: newAiOutfits,
      };
    },
    enabled: !!prompt,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}
