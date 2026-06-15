"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "../../styles/glow.css";
import {
  garmentService,
  type RemoteGarment,
} from "@/modules/shared/api/garment.service";
import { FittingSlot } from "@/modules/garment/types";
import {
  outfitService,
  type RemoteOutfit,
} from "@/modules/shared/api/outfit.service";
import {
  chatWonderService,
  type ChatWonderMessageResponse,
} from "@/modules/shared/api/chat-wonder.service";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useOverviewStore } from "@/modules/overview/store/useOverviewStore";
import { useVoice } from "@/modules/shared/voice/useVoice";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import { ChatNavLoader } from "@/components/ChatNavLoader";
import { QuoteCarousel } from "@/components/QuoteCarousel";
import MirrorHeader from "@/components/MirrorHeader";
import { PromptFloater } from "@/components/PromptFloater";
import { getToday } from "@/components/QuickResponseChips";
import { useWeather } from "@/modules/shared/hooks/useWeather";
import { OutfitPreviewModal } from "@/modules/fashion/components/OutfitPreviewModal";
import { OutfitListPanel } from "@/modules/fashion/components/OutfitListPanel";
import {
  GarmentSelectionPanel,
  type GarmentSlotConfig,
} from "@/modules/fashion/components/GarmentSelectionPanel";
import type { SwapSlot } from "@/modules/fashion/types";
import { useSwipe } from "@/modules/fashion/hooks/useSwipe";
import {
  FASHION_QUOTES,
  FASHION_PROMPT_KEY,
} from "@/modules/fashion/constants";
import type { OutfitPreviewCanvasHandle } from "@/components/OutfitPreviewCanvas";

export default function VirtualMirrorV2() {
  const { weather } = useWeather();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const { isProcessing, submitText } = useVoiceContext();
  const [isFetching, setIsFetching] = useState(false);
  const isLoading = isProcessing || isFetching;

  const setAssistantIdle = useMirrorStore((s) => s.setAssistantIdle);
  const chatGarmentData = useMirrorStore((s) => s.chatGarmentData);
  const skinAnalysisResult = useMirrorStore((s) => s.skinAnalysisResult);
  useEffect(() => {
    setAssistantIdle(isLoading);
  }, [isLoading, setAssistantIdle]);
  useEffect(
    () => () => {
      setAssistantIdle(false);
    },
    [setAssistantIdle],
  );

  const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedOutfitIdx, setSelectedOutfitIdx] = useState<number | null>(
    null,
  );
  const [selectedBag, setSelectedBag] = useState<RemoteGarment | null>(null);
  const [selectedTopBase, setSelectedTopBase] = useState<RemoteGarment | null>(
    null,
  );
  const [selectedTopMid, setSelectedTopMid] = useState<RemoteGarment | null>(
    null,
  );
  const [selectedTopOuter, setSelectedTopOuter] =
    useState<RemoteGarment | null>(null);
  const [selectedBottom, setSelectedBottom] = useState<RemoteGarment | null>(
    null,
  );
  const [selectedShoe, setSelectedShoe] = useState<RemoteGarment | null>(null);

  const canvasRef = useRef<OutfitPreviewCanvasHandle>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [garmentPanelOpen, setGarmentPanelOpen] = useState(true);

  const [swapSlot, setSwapSlot] = useState<SwapSlot | null>(null);
  const [swapItemId, setSwapItemId] = useState<string | null>(null);
  const [outfitOverrides, setOutfitOverrides] = useState<
    Record<string, RemoteGarment>
  >({});
  const outfitModified = Object.keys(outfitOverrides).length > 0;

  function resolveSwapSlot(
    garmentType: string[],
    fittingSlot: string[],
  ): SwapSlot {
    if (garmentType.includes("Bag")) return "bags";
    if (fittingSlot.includes("LowerGarment")) return "bottoms";
    if (fittingSlot.includes("FootGarment")) return "shoes";
    const t = garmentType[0] ?? "";
    if (["Blazer", "Jacket", "Coat", "Parka", "Windbreaker"].includes(t))
      return "outer";
    if (["Hoodie", "Sweater", "Cardigan", "Pullover"].includes(t)) return "mid";
    return "base";
  }

  function applySwap(g: RemoteGarment) {
    if (!swapItemId) return;
    setOutfitOverrides((prev) => ({ ...prev, [swapItemId]: g }));
  }

  function cancelSwap() {
    setSwapSlot(null);
    setSwapItemId(null);
  }

  const clearSlots = useCallback(() => {
    setSelectedBag(null);
    setSelectedTopBase(null);
    setSelectedTopMid(null);
    setSelectedTopOuter(null);
    setSelectedBottom(null);
    setSelectedShoe(null);
  }, []);

  const selectOutfit = useCallback(
    (idx: number) => {
      setSelectedOutfitIdx(idx);
      setGarmentPanelOpen(false);
      clearSlots();
      setOutfitOverrides({});
      setSwapSlot(null);
      setSwapItemId(null);
    },
    [clearSlots],
  );

  const handleGarmentPanelOpenChange = useCallback((open: boolean) => {
    setGarmentPanelOpen(open);
    if (!open) return;
    setSelectedOutfitIdx(null);
    setOutfitOverrides({});
    setSwapSlot(null);
    setSwapItemId(null);
  }, []);

  const outfitPageSize = 4;
  const [outfitPage, setOutfitPage] = useState(0);
  const totalOutfitPages = Math.max(
    1,
    Math.ceil(outfits.length / outfitPageSize),
  );
  const pagedOutfits = outfits.slice(
    outfitPage * outfitPageSize,
    (outfitPage + 1) * outfitPageSize,
  );
  const outfitSwipe = useSwipe(
    () => setOutfitPage((p) => Math.min(p + 1, totalOutfitPages - 1)),
    () => setOutfitPage((p) => Math.max(p - 1, 0)),
  );

  const bottomsPageSize = 6;
  const shoesPageSize = 6;
  const accessoryPageSize = 2;
  const topsLayerPageSize = 2;

  const [topsBase, setTopsBase] = useState<RemoteGarment[]>([]);
  const [topsMid, setTopsMid] = useState<RemoteGarment[]>([]);
  const [topsOuter, setTopsOuter] = useState<RemoteGarment[]>([]);
  const [catalogTopsBase, setCatalogTopsBase] = useState<RemoteGarment[]>([]);
  const [catalogTopsMid, setCatalogTopsMid] = useState<RemoteGarment[]>([]);
  const [catalogTopsOuter, setCatalogTopsOuter] = useState<RemoteGarment[]>([]);
  const [catalogBottoms, setCatalogBottoms] = useState<RemoteGarment[]>([]);
  const [catalogShoes, setCatalogShoes] = useState<RemoteGarment[]>([]);
  const [catalogBags, setCatalogBags] = useState<RemoteGarment[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [topsBasePage, setTopsBasePage] = useState(0);
  const [topsMidPage, setTopsMidPage] = useState(0);
  const [topsOuterPage, setTopsOuterPage] = useState(0);

  const swappingGarmentId = (() => {
    if (!swapItemId || selectedOutfitIdx === null) return null;
    const outfit = outfits[selectedOutfitIdx];
    if (!outfit) return null;
    const item = outfit.items.find((i) => i.id === swapItemId);
    if (!item) return null;
    return (outfitOverrides[swapItemId] ?? item.garment).id;
  })();

  const filteredTopsBase =
    swapSlot === "base" && swappingGarmentId
      ? topsBase.filter((g) => g.id !== swappingGarmentId)
      : topsBase;
  const filteredTopsMid =
    swapSlot === "mid" && swappingGarmentId
      ? topsMid.filter((g) => g.id !== swappingGarmentId)
      : topsMid;
  const filteredTopsOuter =
    swapSlot === "outer" && swappingGarmentId
      ? topsOuter.filter((g) => g.id !== swappingGarmentId)
      : topsOuter;

  const pagedTopsBase = filteredTopsBase.slice(
    topsBasePage * topsLayerPageSize,
    (topsBasePage + 1) * topsLayerPageSize,
  );
  const pagedTopsMid = filteredTopsMid.slice(
    topsMidPage * topsLayerPageSize,
    (topsMidPage + 1) * topsLayerPageSize,
  );
  const pagedTopsOuter = filteredTopsOuter.slice(
    topsOuterPage * topsLayerPageSize,
    (topsOuterPage + 1) * topsLayerPageSize,
  );

  const [shoes, setShoes] = useState<RemoteGarment[]>([]);
  const [shoesPage, setShoesPage] = useState(0);
  const filteredShoes =
    swapSlot === "shoes" && swappingGarmentId
      ? shoes.filter((g) => g.id !== swappingGarmentId)
      : shoes;
  const pagedShoes = filteredShoes.slice(
    shoesPage * shoesPageSize,
    (shoesPage + 1) * shoesPageSize,
  );

  const [bottoms, setBottoms] = useState<RemoteGarment[]>([]);
  const [bottomsPage, setBottomsPage] = useState(0);
  const filteredBottoms =
    swapSlot === "bottoms" && swappingGarmentId
      ? bottoms.filter((g) => g.id !== swappingGarmentId)
      : bottoms;
  const pagedBottoms = filteredBottoms.slice(
    bottomsPage * bottomsPageSize,
    (bottomsPage + 1) * bottomsPageSize,
  );

  const [bags, setBags] = useState<RemoteGarment[]>([]);

  const [bagsPage, setBagsPage] = useState(0);
  const filteredBags =
    swapSlot === "bags" && swappingGarmentId
      ? bags.filter((g) => g.id !== swappingGarmentId)
      : bags;
  const pagedBags = filteredBags.slice(
    bagsPage * accessoryPageSize,
    (bagsPage + 1) * accessoryPageSize,
  );

  useEffect(() => {
    let cancelled = false;
    const OUTER_TYPES = new Set([
      "Blazer",
      "Jacket",
      "Coat",
      "Parka",
      "Windbreaker",
    ]);
    const MID_TYPES = new Set(["Hoodie", "Sweater", "Cardigan", "Pullover"]);

    Promise.all([
      garmentService.getBySlot(FittingSlot.UpperGarment),
      garmentService.getBySlot(FittingSlot.LowerGarment),
      garmentService.getBySlot(FittingSlot.FootGarment),
      garmentService.getBySlot(FittingSlot.RightHandAccessory),
    ])
      .then(([upperItems, lowerItems, footItems, bagItems]) => {
        if (cancelled) return;
        setCatalogTopsOuter(
          upperItems.filter((g) =>
            g.garmentType.some((t) => OUTER_TYPES.has(t)),
          ),
        );
        setCatalogTopsMid(
          upperItems.filter((g) => g.garmentType.some((t) => MID_TYPES.has(t))),
        );
        setCatalogTopsBase(
          upperItems.filter(
            (g) =>
              !g.garmentType.some(
                (t) => OUTER_TYPES.has(t) || MID_TYPES.has(t),
              ),
          ),
        );
        setCatalogBottoms(lowerItems);
        setCatalogShoes(footItems);
        setCatalogBags(bagItems);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAiComplete = useCallback(
    async (response: ChatWonderMessageResponse) => {
      setSelectedBag(null);
      setSelectedTopBase(null);
      setSelectedTopMid(null);
      setSelectedTopOuter(null);
      setSelectedBottom(null);
      setSelectedShoe(null);
      setSelectedOutfitIdx(null);

      const rawData = response.garment_data as Record<string, unknown> | null;
      const query = typeof rawData?.query === "string" ? rawData.query : null;

      if (query) {
        setIsFetching(true);
        // New format: ChatWonder sends query params, we fetch real DB outfits
        try {
          const fetchedOutfits = await outfitService.getByQuery(query);
          const newTopsBase: RemoteGarment[] = [];
          const newTopsMid: RemoteGarment[] = [];
          const newTopsOuter: RemoteGarment[] = [];
          const newBottoms: RemoteGarment[] = [];
          const newShoes: RemoteGarment[] = [];
          const newBags: RemoteGarment[] = [];
          const seen = new Set<string>();

          for (const outfit of fetchedOutfits) {
            for (const item of outfit?.items || []) {
              const g = item?.garment;
              if (!g) continue;
              if (seen.has(g.id)) continue;
              seen.add(g.id);

              const mapped: RemoteGarment = {
                id: g.id,
                name: g.name || "",
                description: g.description ?? "",
                imageUrl: g.imageUrl || "",
                fittingSlot: g.fittingSlot || [],
                garmentType: g.garmentType || [],
                category: [],
                tags: [],
                gender: null,
                silhouette: null,
                layerLevel: g.layerLevel ?? null,
                file: null,
              };

              if (mapped.fittingSlot.includes("UpperGarment")) {
                const layer = g.layerLevel ?? "BASE";
                if (layer === "OUTER") newTopsOuter.push(mapped);
                else if (layer === "MID") newTopsMid.push(mapped);
                else newTopsBase.push(mapped);
              } else if (mapped.fittingSlot.includes("LowerGarment")) {
                newBottoms.push(mapped);
              } else if (mapped.fittingSlot.includes("FootGarment")) {
                newShoes.push(mapped);
              } else if (mapped.garmentType.includes("Bag")) {
                newBags.push(mapped);
              }
            }
          }

          setTopsBase(newTopsBase);
          setTopsBasePage(0);
          setTopsMid(newTopsMid);
          setTopsMidPage(0);
          setTopsOuter(newTopsOuter);
          setTopsOuterPage(0);
          setBottoms(newBottoms);
          setBottomsPage(0);
          setShoes(newShoes);
          setShoesPage(0);
          setBags(newBags);
          setBagsPage(0);
          setOutfits(fetchedOutfits);
          setOutfitPage(0);
          setHasFetched(true);
          if (fetchedOutfits.length > 0) {
            setSelectedOutfitIdx(0);
          }
        } catch (err) {
          console.error(err);
          setHasFetched(true); // Prevent "sudden reset" to idle screen on error
        } finally {
          setIsFetching(false);
        }
        return;
      }

      // Legacy format: ChatWonder sends sets[] with inline recommendations
      type AiItem = {
        id?: string;
        name: string;
        type?: string;
        description?: string;
        reason?: string;
        imageUrl?: string;
        category?: string | string[];
        garmentType?: string[];
        fittingSlot?: string[];
        layerLevel?: string;
      };

      const sets = Array.isArray(rawData?.sets)
        ? (rawData?.sets as Record<string, unknown>[])
        : [];
      const newTopsBase: RemoteGarment[] = [];
      const newTopsMid: RemoteGarment[] = [];
      const newTopsOuter: RemoteGarment[] = [];
      const newBottoms: RemoteGarment[] = [];
      const newShoes: RemoteGarment[] = [];
      const newBags: RemoteGarment[] = [];
      const seen = new Set<string>();

      const toGarment = (item: AiItem, slot: string): RemoteGarment => ({
        id: item.id ?? crypto.randomUUID(),
        name: item.name,
        description: item.reason ?? item.description ?? "",
        imageUrl: item.imageUrl ?? "",
        fittingSlot: [slot],
        garmentType: item.garmentType ?? (item.type ? [item.type] : []),
        category: Array.isArray(item.category)
          ? item.category
          : item.category
            ? [item.category]
            : [],
        tags: [],
        gender: null,
        silhouette: null,
        layerLevel: item.layerLevel ?? null,
        file: null,
      });

      function push(
        item: AiItem | undefined,
        bucket: RemoteGarment[],
        slot: string,
      ) {
        if (!item?.id) return;
        if (seen.has(item.id)) return;
        seen.add(item.id);
        bucket.push(toGarment(item, slot));
      }

      for (const s of sets) {
        for (const r of (Array.isArray(s.recommendations)
          ? s.recommendations
          : []) as AiItem[]) {
          if (r.fittingSlot?.includes("UpperGarment")) {
            const layer = r.layerLevel ?? "BASE";
            if (layer === "OUTER") push(r, newTopsOuter, "UpperGarment");
            else if (layer === "MID") push(r, newTopsMid, "UpperGarment");
            else push(r, newTopsBase, "UpperGarment");
          }
          if (r.fittingSlot?.includes("LowerGarment"))
            push(r, newBottoms, "LowerGarment");
          if (r.fittingSlot?.includes("FootGarment"))
            push(r, newShoes, "FootGarment");
          if (r.garmentType?.includes("Bag"))
            push(r, newBags, "RightHandAccessory");
        }
      }
      setTopsBase(newTopsBase);
      setTopsMid(newTopsMid);
      setTopsOuter(newTopsOuter);
      setBottoms(newBottoms);
      setShoes(newShoes);
      setBags(newBags);
      setBagsPage(0);

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
      setOutfits(newAiOutfits);
      setOutfitPage(0);
      setHasFetched(true);
      if (newAiOutfits.length > 0) {
        setSelectedOutfitIdx(0);
      }
    },
    [
      setTopsBase,
      setTopsBasePage,
      setTopsMid,
      setTopsMidPage,
      setTopsOuter,
      setTopsOuterPage,
      setBottoms,
      setBottomsPage,
      setShoes,
      setShoesPage,
      setBags,
      setBagsPage,
      setOutfits,
      setOutfitPage,
      setSelectedBag,
      setSelectedTopBase,
      setSelectedTopMid,
      setSelectedTopOuter,
      setSelectedBottom,
      setSelectedShoe,
      setSelectedOutfitIdx,
      setHasFetched,
      setIsFetching,
    ],
  );

  const handleChipSelect = useCallback(
    async (prompt: string) => {
      setIsFetching(true);
      try {
        const storeGender = useOverviewStore.getState().pendingGender;
        const response = await chatWonderService.message({
          input: `[stylist] ${prompt}`,
          pageMode: "garment",
          set: 6,
          voice: false,
          ...(weather
            ? { weather: weather as unknown as Record<string, unknown> }
            : {}),
          skinAnalysis: skinAnalysisResult,
          ...(storeGender ? { gender: storeGender } : {}),
        });
        if (response.garment_data) {
          await handleAiComplete(response as ChatWonderMessageResponse);
        }
      } catch (err) {
        console.error("[fashion-chip]", err);
      } finally {
        setIsFetching(false);
      }
    },
    [weather, skinAnalysisResult, handleAiComplete],
  );

  const fashionPageContext = useMemo(
    () => ({
      route: "/ai-recommendation-fashion",
      pageName: "Fashion Recommendations",
      mode: "garment" as const,
    }),
    [],
  );

  const handleVoiceAction = useCallback(
    (action: ChatWonderAction) => {
      if (action.type === "fashion_select_outfit") {
        const idx = action.index;
        if (idx < 0 || idx >= outfits.length) return;
        setOutfitPage(Math.floor(idx / outfitPageSize));
        selectOutfit(idx);
        return;
      }
      if (action.type === "fashion_select_garment") {
        const { slot, index } = action;
        type SlotEntry = {
          arr: RemoteGarment[];
          set: (g: RemoteGarment) => void;
        };
        const slotMap: Record<typeof slot, SlotEntry> = {
          base: { arr: pagedTopsBase, set: setSelectedTopBase },
          mid: { arr: pagedTopsMid, set: setSelectedTopMid },
          outer: { arr: pagedTopsOuter, set: setSelectedTopOuter },
          bottoms: { arr: pagedBottoms, set: setSelectedBottom },
          shoes: { arr: pagedShoes, set: setSelectedShoe },
          bags: { arr: pagedBags, set: setSelectedBag },
        };
        const target = slotMap[slot];
        const garment = target.arr[index];
        if (!garment) return;
        if (swapSlot === slot && swapItemId) {
          const id = swapItemId;
          setOutfitOverrides((prev) => ({ ...prev, [id]: garment }));
          setSwapSlot(null);
          setSwapItemId(null);
        } else {
          target.set(garment);
          setSelectedOutfitIdx(null);
        }
      }
    },
    [
      outfits,
      outfitPageSize,
      selectOutfit,
      pagedTopsBase,
      pagedTopsMid,
      pagedTopsOuter,
      pagedBottoms,
      pagedShoes,
      pagedBags,
      swapSlot,
      swapItemId,
      setSelectedTopBase,
      setSelectedTopMid,
      setSelectedTopOuter,
      setSelectedBottom,
      setSelectedShoe,
      setSelectedBag,
      setSelectedOutfitIdx,
      setOutfitOverrides,
      setSwapSlot,
      setSwapItemId,
    ],
  );

  useVoice(fashionPageContext, handleVoiceAction);

  // Re-fetch whenever URL params change — covers both initial mount and
  // chip-tap navigation (?metaCategory=Casual&limit=4 etc.).
  // limit=4 is injected if the caller omitted it.
  const lastSearchParamsRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSearchParamsRef.current === currentSearch) return;
    lastSearchParamsRef.current = currentSearch;

    // Do not auto-fetch if there are no query parameters — leave idle state showing.
    if (!currentSearch) {
      queueMicrotask(() => setOutfits([]));
      return;
    }

    const params = new URLSearchParams(currentSearch);
    if (!params.has("limit")) params.set("limit", "4");
    queueMicrotask(() =>
      handleAiComplete({
        garment_data: { query: params.toString() },
      } as ChatWonderMessageResponse),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSearch]);

  // Consume a fashion prompt forwarded from the AI assistant via sessionStorage.
  const handoffFiredRef = useRef(false);
  useEffect(() => {
    if (handoffFiredRef.current) return;
    const prompt = sessionStorage.getItem(FASHION_PROMPT_KEY);
    if (!prompt) return;
    handoffFiredRef.current = true;
    sessionStorage.removeItem(FASHION_PROMPT_KEY);
    void submitText(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume garment data forwarded from another page (VoiceProvider stores it
  // via setPendingGarmentData right before the stylist navigation pushes here).
  useEffect(() => {
    const pending = useMirrorStore.getState().pendingGarmentData;
    if (!pending) return;
    useMirrorStore.getState().setPendingGarmentData(null);
    setTimeout(() => {
      handleAiComplete({ garment_data: pending } as ChatWonderMessageResponse);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume garment data from the chat/voice path when already on this page
  // (VoiceProvider/ChatWonderProvider set chatGarmentData instead of navigating).
  useEffect(() => {
    if (!chatGarmentData) return;
    useMirrorStore.getState().setChatGarmentData(null);
    Promise.resolve().then(() =>
      handleAiComplete({
        garment_data: chatGarmentData,
      } as ChatWonderMessageResponse),
    );
  }, [chatGarmentData, handleAiComplete]);

  // Select a garment for a slot — applies a pending swap, or sets the slot and
  // clears the active outfit selection (same behavior as the old inline grids).
  const handleSlotSelect = (slot: SwapSlot, g: RemoteGarment) => {
    if (swapSlot === slot && swapItemId) {
      applySwap(g);
      return;
    }
    const setters: Record<SwapSlot, (g: RemoteGarment) => void> = {
      base: setSelectedTopBase,
      mid: setSelectedTopMid,
      outer: setSelectedTopOuter,
      bottoms: setSelectedBottom,
      shoes: setSelectedShoe,
      bags: setSelectedBag,
    };
    setters[slot](g);
    setSelectedOutfitIdx(null);
  };

  const garmentSlots: GarmentSlotConfig[] = [
    {
      key: "base",
      label: "Base",
      items: catalogTopsBase,
      pagedItems: catalogTopsBase,
      pageSize: catalogTopsBase.length,
      currentPage: 0,
      totalPages: 1,
      onPageChange: () => undefined,
      selectedId: selectedTopBase?.id,
      loading: catalogLoading,
      emptyMessage: catalogLoading ? "Loading Base" : "No Base garments",
    },
    {
      key: "mid",
      label: "Mid",
      items: catalogTopsMid,
      pagedItems: catalogTopsMid,
      pageSize: catalogTopsMid.length,
      currentPage: 0,
      totalPages: 1,
      onPageChange: () => undefined,
      selectedId: selectedTopMid?.id,
      loading: catalogLoading,
      emptyMessage: catalogLoading ? "Loading Mid" : "No Mid garments",
    },
    {
      key: "outer",
      label: "Outer",
      items: catalogTopsOuter,
      pagedItems: catalogTopsOuter,
      pageSize: catalogTopsOuter.length,
      currentPage: 0,
      totalPages: 1,
      onPageChange: () => undefined,
      selectedId: selectedTopOuter?.id,
      loading: catalogLoading,
      emptyMessage: catalogLoading ? "Loading Outer" : "No Outer garments",
    },
    {
      key: "bottoms",
      label: "Bottoms",
      items: catalogBottoms,
      pagedItems: catalogBottoms,
      pageSize: catalogBottoms.length,
      currentPage: 0,
      totalPages: 1,
      onPageChange: () => undefined,
      selectedId: selectedBottom?.id,
      loading: catalogLoading,
      emptyMessage: catalogLoading ? "Loading Bottoms" : "No Bottom garments",
    },
    {
      key: "shoes",
      label: "Shoes",
      items: catalogShoes,
      pagedItems: catalogShoes,
      pageSize: catalogShoes.length,
      currentPage: 0,
      totalPages: 1,
      onPageChange: () => undefined,
      selectedId: selectedShoe?.id,
      loading: catalogLoading,
      emptyMessage: catalogLoading ? "Loading Shoes" : "No Shoe garments",
    },
    {
      key: "bags",
      label: "Accessories",
      items: catalogBags,
      pagedItems: catalogBags,
      pageSize: catalogBags.length,
      currentPage: 0,
      totalPages: 1,
      onPageChange: () => undefined,
      selectedId: selectedBag?.id,
      columns: 2,
      loading: catalogLoading,
      emptyMessage: catalogLoading
        ? "Loading Accessories"
        : "No Accessory garments",
    },
  ];

  const hasRecommendations = outfits.length > 0;

  useEffect(() => {
    if (!hasFetched || isLoading || hasRecommendations) return;
    const t = setTimeout(() => router.replace("/fashion-catalog"), 3000);
    return () => clearTimeout(t);
  }, [hasFetched, isLoading, hasRecommendations, router]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-canvas flex flex-col pb-24">
      <ChatNavLoader />

      <MirrorHeader onBack={() => router.back()} />

      {/* Action row — Suggestions, between header and outfit panels */}
      {!isLoading && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            padding: "6px 16px",
            flexShrink: 0,
          }}
        >
          <PromptFloater
            onSelect={handleChipSelect}
            weather={weather}
            prompts={[
              `Style me for today, ${getToday()}.`,
              "Give me a low-effort but good-looking outfit.",
              "Make me look confident and put-together today.",
              "Suggest an outfit that matches a busy day.",
              "Build a “effortless cool” look.",
              "Dress me like I’m going somewhere important but chill.",
              "Give me a clean aesthetic outfit.",
              "Style something that feels modern and minimal.",
              "Put together a look that boosts confidence.",
              "Suggest an outfit that works from day to night.",
              "Build a comfortable but sharp outfit.",
              "Give me something that looks expensive but simple.",
              "Style me for a productive workday vibe.",
              "Create a relaxed but polished look.",
              "Suggest an outfit that feels fresh and new.",
              "Build a “don’t overthink it” outfit for today.",
              "Style something that matches a creative mindset.",
              "Give me an outfit that feels clean and breathable.",
              "Put together something versatile for any plan today.",
              "Suggest a look that feels confident without trying too hard.",
            ]}
            className="relative z-40"
            direction="below"
          />
        </div>
      )}

      {/* AI Suggestion Banner */}
      <div className="px-4 pb-2 z-10" style={{ marginTop: "-8px" }} />

      {/* Idle state — no fetch started yet */}
      {!isLoading && !hasFetched && (
        <QuoteCarousel
          quotes={FASHION_QUOTES}
          label="Style tip"
          className="flex-1 flex flex-col items-center justify-center px-6 pt-6 pb-22 text-center"
        />
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left panel — recommended outfit list */}
        {hasRecommendations && !isLoading && (
          <OutfitListPanel
            outfits={outfits}
            pagedOutfits={pagedOutfits}
            outfitPage={outfitPage}
            outfitPageSize={outfitPageSize}
            totalOutfitPages={totalOutfitPages}
            selectedOutfitIdx={selectedOutfitIdx}
            isProcessing={isLoading}
            swipeHandlers={outfitSwipe}
            onSelect={selectOutfit}
            onPageChange={setOutfitPage}
          />
        )}

        {/* Center panel */}
        {(() => {
          const selectedOutfit =
            selectedOutfitIdx !== null
              ? (outfits[selectedOutfitIdx] ?? null)
              : null;
          return (
            <div
              className="h-full flex flex-col items-center pt-2 gap-1 overflow-hidden"
              style={{ flex: "1 1 0", minWidth: 0, minHeight: 0 }}
            >
              {/* Outfit display */}
              {selectedOutfit && !isLoading && (
                <div
                  style={{
                    width: "100%",
                    padding: "0 12px",
                    paddingBottom: "80px",
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    overflow: "hidden",
                  }}
                >
                  {/* Image — proportional flex share, no fixed height */}
                  <div
                    style={{
                      flex: "7 1 0",
                      minHeight: 0,
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.01)",
                    }}
                  >
                    {selectedOutfit.file?.fileUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedOutfit.file.fileUrl}
                        alt={selectedOutfit.name}
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          pointerEvents: "none",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          style={{
                            color: "rgba(255,255,255,0.2)",
                            fontSize: "12px",
                          }}
                        >
                          No Image
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Name & description — fixed, description clipped to 2 lines */}
                  <div
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: "6px",
                      marginTop: "4px",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        color: "white",
                        fontSize: "24px",
                        fontWeight: 700,
                        lineHeight: 1.3,
                        overflow: "hidden",
                      }}
                    >
                      {selectedOutfit.name}
                    </span>
                    {selectedOutfit.description && (
                      <span
                        style={{
                          color: "rgba(255,255,255,0.6)",
                          fontSize: "14px",
                          lineHeight: 1.5,
                          overflow: "hidden",
                          maxHeight: "3em",
                        }}
                      >
                        {selectedOutfit.description}
                      </span>
                    )}
                  </div>
                  {/* Garment cards — remaining flex space, each card grows equally */}
                  {selectedOutfit.items.length > 0 && (
                    <div
                      style={{
                        flex: "3 1 0",
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        overflow: "hidden",
                      }}
                    >
                      {selectedOutfit.items
                        .slice()
                        .sort((a, b) => {
                          const UPPER = [
                            "Shirt",
                            "TShirt",
                            "Polo",
                            "Blouse",
                            "Hoodie",
                            "Sweater",
                            "Jacket",
                            "Coat",
                            "Blazer",
                          ];
                          const LOWER = ["Pants", "Jeans", "Shorts", "Skirt"];
                          const FOOT = [
                            "Shoes",
                            "Sneakers",
                            "Sandals",
                            "Boots",
                            "Heels",
                            "Socks",
                          ];
                          const HEAD = ["Hat", "Beanie", "Cap", "Headband"];
                          const rank = (types: string[]) => {
                            const t = types[0] ?? "";
                            if (UPPER.includes(t)) return 0;
                            if (LOWER.includes(t)) return 1;
                            if (FOOT.includes(t)) return 2;
                            if (HEAD.includes(t)) return 3;
                            return 4;
                          };
                          return (
                            rank(a.garment.garmentType) -
                            rank(b.garment.garmentType)
                          );
                        })
                        .map((item) => {
                          const effective =
                            outfitOverrides[item.id] ?? item.garment;
                          const isSwapping = swapItemId === item.id;
                          const isOverridden = !!outfitOverrides[item.id];
                          return (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              aria-pressed={isSwapping}
                              className="flex focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.currentTarget.click();
                                }
                              }}
                              onClick={() => {
                                const slot = resolveSwapSlot(
                                  item.garment.garmentType,
                                  item.garment.fittingSlot,
                                );
                                if (isSwapping) {
                                  cancelSwap();
                                  return;
                                }
                                setGarmentPanelOpen(true);
                                setSwapSlot(slot);
                                setSwapItemId(item.id);
                              }}
                              style={{
                                flex: "1 1 0",
                                minHeight: 0,
                                width: "100%",
                                alignItems: "stretch",
                                overflow: "hidden",
                                background: "transparent",
                                cursor: "pointer",
                                border: isSwapping
                                  ? "1.5px solid rgba(255,255,255,0.6)"
                                  : isOverridden
                                    ? "1.5px solid rgba(100,220,120,0.5)"
                                    : "1.5px solid transparent",
                                borderRadius: "8px",
                                transition: "border-color 0.15s",
                              }}
                            >
                              <div
                                style={{
                                  flex: "0 0 38%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderRadius: "8px 0 0 8px",
                                  overflow: "hidden",
                                }}
                              >
                                {effective.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={effective.imageUrl}
                                    alt={effective.name}
                                    draggable={false}
                                    className="w-full h-full object-contain pointer-events-none"
                                  />
                                ) : (
                                  <span
                                    style={{
                                      color: "rgba(255,255,255,0.25)",
                                      fontSize: "10px",
                                    }}
                                  >
                                    No Image
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  padding: "5px 8px",
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "center",
                                  gap: "2px",
                                  overflow: "hidden",
                                }}
                              >
                                <span
                                  style={{
                                    color: "rgba(255,255,255,0.35)",
                                    fontSize: "8px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    overflow: "hidden",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {isOverridden
                                    ? "Changed"
                                    : effective.garmentType?.[0]}
                                </span>
                                <span
                                  style={{
                                    color: "white",
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    lineHeight: 1.3,
                                    overflow: "hidden",
                                  }}
                                >
                                  {effective.name}
                                </span>
                                <span
                                  style={{
                                    color: "rgba(255,255,255,0.45)",
                                    fontSize: "9px",
                                    lineHeight: 1.4,
                                    overflow: "hidden",
                                  }}
                                >
                                  {effective.description}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Loading state — cycling fashion quotes */}
              {isLoading && (
                <QuoteCarousel
                  quotes={FASHION_QUOTES}
                  label="Style tip"
                  className="flex-1 flex flex-col items-center justify-center px-6 pt-6 pb-[88px] text-center"
                />
              )}

              {/* No results — brief notice before redirect */}
              {!isLoading && hasFetched && !hasRecommendations && (
                <div className="flex-1 flex flex-col items-center justify-center px-10 text-center">
                  <p className="text-white/40 text-sm font-light leading-relaxed tracking-wide">
                    There is no outfit currently out in our drawer for the
                    current weather and condition.
                  </p>
                </div>
              )}

              {/* Garment slot cards */}
              {!selectedOutfit && !isLoading && (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                    padding: "0 10px 88px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    overflow: "hidden",
                    background: "transparent",
                  }}
                >
                  {[
                    selectedTopBase,
                    selectedTopMid,
                    selectedTopOuter,
                    selectedBag,
                    selectedBottom,
                    selectedShoe,
                  ]
                    .filter((g): g is RemoteGarment => g !== null)
                    .map((g) => (
                      <div
                        key={g.id}
                        className="flex"
                        style={{
                          flexShrink: 0,
                          height: "110px",
                          width: "100%",
                          alignItems: "stretch",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            flex: "0 0 38%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "8px 0 0 8px",
                            overflow: "hidden",
                          }}
                        >
                          {g.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={g.imageUrl}
                              alt={g.name}
                              draggable={false}
                              className="w-full h-full object-contain pointer-events-none"
                            />
                          ) : (
                            <span
                              style={{
                                color: "rgba(255,255,255,0.25)",
                                fontSize: "9px",
                              }}
                            >
                              No Image
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: "8px 10px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            gap: "3px",
                            overflow: "hidden",
                          }}
                        >
                          <span
                            style={{
                              color: "rgba(255,255,255,0.4)",
                              fontSize: "9px",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {g.layerLevel ?? g.garmentType[0]}
                          </span>
                          <span
                            style={{
                              color: "white",
                              fontSize: "11px",
                              fontWeight: 600,
                              lineHeight: 1.3,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {g.name}
                          </span>
                          <span
                            style={{
                              color: "rgba(255,255,255,0.45)",
                              fontSize: "9px",
                              lineHeight: 1.4,
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {g.description}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Right panel — per-slot garment pickers */}
        {hasRecommendations && !isLoading && (
          <GarmentSelectionPanel
            slots={garmentSlots}
            swapSlot={swapSlot}
            isProcessing={isLoading}
            isOpen={garmentPanelOpen}
            onOpenChange={handleGarmentPanelOpenChange}
            onCancelSwap={cancelSwap}
            onSelect={handleSlotSelect}
          />
        )}
      </div>

      {showConfirm && (
        <OutfitPreviewModal
          outfitModified={outfitModified}
          activeOutfit={
            selectedOutfitIdx !== null
              ? (outfits[selectedOutfitIdx] ?? null)
              : null
          }
          outfitOverrides={outfitOverrides}
          selectedTopBase={selectedTopBase}
          selectedTopMid={selectedTopMid}
          selectedTopOuter={selectedTopOuter}
          selectedBottom={selectedBottom}
          selectedShoe={selectedShoe}
          selectedBag={selectedBag}
          canvasRef={canvasRef}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
