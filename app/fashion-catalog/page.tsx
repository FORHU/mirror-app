"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "../../styles/glow.css";
import type { RemoteGarment } from "@/modules/shared/api/garment.service";
import {
  outfitService,
  type RemoteOutfit,
} from "@/modules/shared/api/outfit.service";
import {
  chatWonderService,
  type ChatWonderMessageResponse,
} from "@/modules/shared/api/chat-wonder.service";
import { useVoice } from "@/modules/shared/voice/useVoice";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import { ChatNavLoader } from "@/components/ChatNavLoader";
import { QuoteCarousel } from "@/components/QuoteCarousel";
import MirrorHeader from "@/components/MirrorHeader";
import { PromptFloater } from "@/components/PromptFloater";
import { QuickResponseChips, getToday } from "@/components/QuickResponseChips";
import { OutfitPreviewModal } from "@/modules/fashion/components/OutfitPreviewModal";
import { OutfitImageCarousel } from "@/modules/fashion/components/OutfitImageCarousel";
import { MarqueeColumn } from "@/modules/shared/components/MarqueeColumn";

import type { SwapSlot } from "@/modules/fashion/types";
import { useSwipe } from "@/modules/fashion/hooks/useSwipe";
import {
  FASHION_QUOTES,
  FASHION_PROMPT_KEY,
} from "@/modules/fashion/constants";
import type { OutfitPreviewCanvasHandle } from "@/components/OutfitPreviewCanvas";

const MAIN_CATEGORIES = ["All", "Casual", "Formal", "Outdoor"];
const CATEGORY_MAP: Record<string, string[]> = {
  Outdoor: [
    "Winterwear",
    "Summerwear",
    "Rainwear",
    "Springwear",
    "Autumnwear",
    "Sportswear",
    "Activewear",
  ],
  Casual: [
    "Casual",
    "Streetwear",
    "Athleisure",
    "Vintage",
    "Minimalist",
    "AvantGarde",
    "Traditional",
    "Cultural",
  ],
  Formal: ["Formal", "Business", "SmartCasual", "Luxury", "Uniform"],
};

export default function FashionCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isChipLoading, setIsChipLoading] = useState(false);
  const isLoading = isChipLoading;

  const [activeMainCategory, setActiveMainCategory] = useState<string>("All");

  const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
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

  const [swapSlot] = useState<SwapSlot | null>(null);
  const [swapItemId] = useState<string | null>(null);
  const [outfitOverrides, setOutfitOverrides] = useState<
    Record<string, RemoteGarment>
  >({});
  const outfitModified = Object.keys(outfitOverrides).length > 0;

  const clearSlots = useCallback(() => {
    setSelectedBag(null);
    setSelectedTopBase(null);
    setSelectedTopMid(null);
    setSelectedTopOuter(null);
    setSelectedBottom(null);
    setSelectedShoe(null);
  }, []);

  const selectOutfit = useCallback(
    (idx: number | null) => {
      setSelectedOutfitIdx(idx);
      clearSlots();
      setOutfitOverrides({});
    },
    [clearSlots],
  );

  const outfitPageSize = 8;
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

  // All outfits split across the two auto-scrolling side columns
  // (even index → left, odd → right). `idx` stays the global index into
  // `outfits` so selection keeps working.
  const [leftOutfits, rightOutfits] = useMemo(() => {
    const left: { outfit: RemoteOutfit; idx: number }[] = [];
    const right: { outfit: RemoteOutfit; idx: number }[] = [];
    outfits.forEach((outfit, idx) =>
      (idx % 2 === 0 ? left : right).push({ outfit, idx }),
    );
    return [left, right];
  }, [outfits]);

  // Card used by both marquee side columns; fixed height since the columns
  // drift continuously instead of fitting a 4-row page.
  const renderOutfitCard = ({
    outfit,
    idx,
  }: {
    outfit: RemoteOutfit;
    idx: number;
  }) => (
    <div
      key={outfit.id}
      role="button"
      tabIndex={0}
      aria-label={`Outfit ${idx + 1}`}
      onClick={() =>
        selectedOutfitIdx === idx ? selectOutfit(null) : selectOutfit(idx)
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}
      style={{
        position: "relative",
        height: "clamp(180px, 24vh, 420px)",
        flex: "0 0 auto",
        borderRadius: "10px",
        overflow: "hidden",
        background: "rgba(255,255,255,0.01)",
        cursor: "pointer",
        border:
          selectedOutfitIdx === idx
            ? "2px solid rgba(255,255,255,0.6)"
            : "2px solid transparent",
        transition: "border-color 0.2s",
      }}
    >
      {outfit.file?.fileUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={outfit.file.fileUrl}
          alt={outfit.name}
          draggable={false}
          className="w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] text-white/20">{outfit.name}</span>
        </div>
      )}
    </div>
  );

  const bottomsPageSize = 6;
  const shoesPageSize = 6;
  const accessoryPageSize = 6;
  const topsLayerPageSize = 2;

  const [topsBase, setTopsBase] = useState<RemoteGarment[]>([]);
  const [topsMid, setTopsMid] = useState<RemoteGarment[]>([]);
  const [topsOuter, setTopsOuter] = useState<RemoteGarment[]>([]);

  const [topsBasePage, setTopsBasePage] = useState(0);
  const [topsMidPage, setTopsMidPage] = useState(0);
  const [topsOuterPage, setTopsOuterPage] = useState(0);

  const pagedTopsBase = topsBase.slice(
    topsBasePage * topsLayerPageSize,
    (topsBasePage + 1) * topsLayerPageSize,
  );
  const pagedTopsMid = topsMid.slice(
    topsMidPage * topsLayerPageSize,
    (topsMidPage + 1) * topsLayerPageSize,
  );
  const pagedTopsOuter = topsOuter.slice(
    topsOuterPage * topsLayerPageSize,
    (topsOuterPage + 1) * topsLayerPageSize,
  );

  const [shoes, setShoes] = useState<RemoteGarment[]>([]);
  const [shoesPage, setShoesPage] = useState(0);
  const pagedShoes = shoes.slice(
    shoesPage * shoesPageSize,
    (shoesPage + 1) * shoesPageSize,
  );

  const [bottoms, setBottoms] = useState<RemoteGarment[]>([]);
  const [bottomsPage, setBottomsPage] = useState(0);
  const pagedBottoms = bottoms.slice(
    bottomsPage * bottomsPageSize,
    (bottomsPage + 1) * bottomsPageSize,
  );

  const [bags, setBags] = useState<RemoteGarment[]>([]);

  const [bagsPage, setBagsPage] = useState(0);
  const pagedBags = bags.slice(
    bagsPage * accessoryPageSize,
    (bagsPage + 1) * accessoryPageSize,
  );

  const handleAiComplete = useCallback(
    (response: ChatWonderMessageResponse) => {
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
        // New format: ChatWonder sends query params, we fetch real DB outfits
        outfitService
          .getByQuery(query)
          .then((fetchedOutfits) => {
            const newTopsBase: RemoteGarment[] = [];
            const newTopsMid: RemoteGarment[] = [];
            const newTopsOuter: RemoteGarment[] = [];
            const newBottoms: RemoteGarment[] = [];
            const newShoes: RemoteGarment[] = [];
            const newBags: RemoteGarment[] = [];
            const seen = new Set<string>();

            for (const outfit of fetchedOutfits) {
              for (const item of outfit.items) {
                const g = item.garment;
                if (seen.has(g.id)) continue;
                seen.add(g.id);

                const mapped: RemoteGarment = {
                  id: g.id,
                  name: g.name,
                  description: g.description ?? "",
                  imageUrl: g.imageUrl,
                  fittingSlot: g.fittingSlot,
                  garmentType: g.garmentType,
                  category: [],
                  tags: [],
                  gender: null,
                  silhouette: null,
                  layerLevel: g.layerLevel ?? null,
                  file: null,
                };

                if (g.fittingSlot.includes("UpperGarment")) {
                  const layer = g.layerLevel ?? "BASE";
                  if (layer === "OUTER") newTopsOuter.push(mapped);
                  else if (layer === "MID") newTopsMid.push(mapped);
                  else newTopsBase.push(mapped);
                } else if (g.fittingSlot.includes("LowerGarment")) {
                  newBottoms.push(mapped);
                } else if (g.fittingSlot.includes("FootGarment")) {
                  newShoes.push(mapped);
                } else if (g.garmentType.includes("Bag")) {
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
          })
          .catch(console.error)
          .finally(() => setIsChipLoading(false));
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
        ? (rawData.sets as Record<string, unknown>[])
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
    ],
  );

  const handleChipSelect = useCallback(
    (prompt: string) => {
      if (prompt === "All") {
        setActiveMainCategory("All");
        router.push("/fashion-catalog");
        return;
      }

      if (MAIN_CATEGORIES.includes(prompt)) {
        setActiveMainCategory(prompt);
        const subCategories = CATEGORY_MAP[prompt] || [];
        if (subCategories.length > 0) {
          router.push(
            `/fashion-catalog?metaCategory=${subCategories.join(",")}`,
          );
        }
        return;
      }
    },
    [router],
  );

  const handlePromptSelect = useCallback(
    async (prompt: string) => {
      setIsChipLoading(true);
      try {
        const response = await chatWonderService.message({
          input: `[stylist] ${prompt}`,
          pageMode: "garment",
        });
        const query = response.garment_data?.query ?? "";
        const params = new URLSearchParams(query);
        if (!params.has("limit")) params.set("limit", "4");

        const fetchedOutfits = await outfitService.getByQuery(
          params.toString(),
        );
        if (fetchedOutfits && fetchedOutfits.length > 0) {
          router.push(`/ai-recommendation-fashion?${params.toString()}`);
        }
      } catch {
        // Do nothing on error
      } finally {
        setIsChipLoading(false);
      }
    },
    [router],
  );

  const fashionPageContext = useMemo(
    () => ({
      route: "/fashion-catalog",
      pageName: "Fashion Catalog",
      mode: "garment" as const,
    }),
    [],
  );

  const handleVoiceAction = useCallback(
    (action: ChatWonderAction) => {
      if (action.type === "GARMENT_RECOMMENDATION") {
        const res = action.response as {
          garment_data?: Record<string, unknown>;
        } | null;
        const query =
          typeof res?.garment_data?.query === "string"
            ? res.garment_data.query
            : "";
        const params = new URLSearchParams(query);
        if (!params.has("limit")) params.set("limit", "4");

        outfitService.getByQuery(params.toString()).then((fetched) => {
          if (fetched && fetched.length > 0) {
            router.push(`/ai-recommendation-fashion?${params.toString()}`);
          }
        });
        return;
      }
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
        } else {
          target.set(garment);
          setSelectedOutfitIdx(null);
        }
      }
    },
    [
      outfits,
      outfitPageSize,
      router,
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
    ],
  );

  useVoice(fashionPageContext, handleVoiceAction);

  // Re-fetch whenever URL params change — covers both initial mount and
  // chip-tap navigation (?metaCategory=Casual&limit=4 etc.).
  // limit=4 is injected if the caller omitted it.
  const lastSearchParamsRef = useRef<string | null>(null);
  useEffect(() => {
    const current = searchParams.toString();
    if (lastSearchParamsRef.current === current) return;
    lastSearchParamsRef.current = current;

    // Do not auto-fetch if there are no query parameters. This leaves
    // the outfits array empty so the idle OutfitImageCarousel can display.
    if (!current) {
      queueMicrotask(() => setOutfits([]));
      return;
    }

    const params = new URLSearchParams(current);
    if (!params.has("limit")) params.set("limit", "100"); // fetch all available outfits

    // Directly trigger the AI-complete path which fetches & maps outfits in one shot
    // Deferred with queueMicrotask to avoid synchronous setState inside an effect body.
    queueMicrotask(() => {
      setIsChipLoading(true);
      handleAiComplete({
        garment_data: { query: params.toString() },
      } as ChatWonderMessageResponse);
    });
    // setIsChipLoading(false) is called inside handleAiComplete's .finally()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Consume a fashion prompt forwarded from the AI assistant via sessionStorage.
  const handoffFiredRef = useRef(false);
  useEffect(() => {
    if (handoffFiredRef.current) return;
    const prompt = sessionStorage.getItem(FASHION_PROMPT_KEY);
    if (!prompt) return;
    handoffFiredRef.current = true;
    sessionStorage.removeItem(FASHION_PROMPT_KEY);
    // SubmitText is gone; we ignore voice prompts on the catalog page.
     
  }, []);

  // TODO: restore ChatWonder garment_data flows once query-param format is confirmed
  // Consume garment data forwarded from /ai-assistant via useMirrorStore.
  // useEffect(() => {
  //   const pending = useMirrorStore.getState().pendingGarmentData;
  //   if (!pending) return;
  //   useMirrorStore.getState().setPendingGarmentData(null);
  //   setTimeout(() => { handleAiComplete({ garment_data: pending } as ChatWonderMessageResponse); }, 0);
  // }, []);

  // Consume garment data from the chat-path nav_early flow (ChatWonderProvider).
  // useEffect(() => {
  //   if (!chatGarmentData) return;
  //   useMirrorStore.getState().setChatGarmentData(null);
  //   setTimeout(() => { handleAiComplete({ garment_data: chatGarmentData } as ChatWonderMessageResponse); }, 0);
  // }, [chatGarmentData]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-canvas flex flex-col">
      <ChatNavLoader />

      <MirrorHeader onBack={() => router.back()} />

      {/* Top filter row */}
      {!isLoading && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "6px 16px",
            flexShrink: 0,
          }}
        >
          <QuickResponseChips
            onSelect={handleChipSelect}
            prompts={MAIN_CATEGORIES}
            activePrompt={activeMainCategory}
            className="relative z-40"
          />
        </div>
      )}

      {/* AI Suggestion Banner */}
      <div className="px-4 pb-2 z-10" style={{ marginTop: "-8px" }} />

      {activeMainCategory === "All" && !isLoading && <OutfitImageCarousel />}

      {activeMainCategory !== "All" && (
        <div className="flex flex-1 w-full" style={{ height: "546px" }}>
          {/* Left panel — outfits 1-4 */}
          <div
            className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden"
            style={{ flex: "0 0 25%", width: "25%" }}
          >
            <MarqueeColumn loop={leftOutfits.length > 0} gap={6}>
              {!isLoading && leftOutfits.map(renderOutfitCard)}
            </MarqueeColumn>
          </div>

          {/* Center panel */}
          <div
            className="h-full flex flex-col items-center pt-8 gap-1 overflow-hidden"
            style={{ flex: "1 1 0", minWidth: 0, minHeight: 0 }}
          >
            {/* Loading state — cycling fashion quotes */}
            {isLoading && (
              <QuoteCarousel
                quotes={FASHION_QUOTES}
                label="Style tip"
                className="flex-1 flex flex-col items-center justify-center px-6 pt-6 pb-[88px] text-center"
              />
            )}

            {/* Idle Reel removed based on sketch layout */}

            {/* Garment slot cards - Shown when an outfit is selected */}
            {selectedOutfitIdx !== null && !isLoading && (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  width: "100%",
                  padding: "0 10px 88px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: "6px",
                  overflow: "hidden",
                  background: "transparent",
                }}
              >
                {outfits[selectedOutfitIdx]?.items.map((item) => {
                  const g = item.garment;
                  return (
                    <div
                      key={g.id}
                      style={{
                        flex: "0 0 auto",
                        height: "auto",
                        minHeight: "76px",
                        background: "rgba(255,255,255,0.06)",
                        backdropFilter: "blur(12px)",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        padding: "10px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        overflow: "hidden",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "8px",
                          background: "rgba(0,0,0,0.3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {g.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.imageUrl}
                            alt={g.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              opacity: 0.85,
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              color: "rgba(255,255,255,0.2)",
                              fontSize: "9px",
                            }}
                          >
                            No IMG
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          gap: "4px",
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
                            fontSize: "12px",
                            fontWeight: 600,
                            lineHeight: 1.3,
                            overflow: "hidden",
                          }}
                        >
                          {g.name}
                        </span>
                        <span
                          style={{
                            color: "rgba(255,255,255,0.45)",
                            fontSize: "11px",
                            lineHeight: 1.4,
                          }}
                        >
                          {g.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel — outfits 5-8 */}
          <div
            className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden"
            style={{ flex: "0 0 25%", width: "25%" }}
          >
            <MarqueeColumn loop={rightOutfits.length > 0} gap={6}>
              {!isLoading && rightOutfits.map(renderOutfitCard)}
            </MarqueeColumn>
          </div>
        </div>
      )}

      {/* Action row — Suggestions, positioned above the mic */}
      {!isLoading && (
        <div className="absolute bottom-[100px] left-0 right-0 z-40 flex flex-col items-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full flex justify-center">
            <PromptFloater
              onSelect={handlePromptSelect}
              prompts={[
                "Formal outfit — top, bottom, shoes, and bag.",
                "Business look that feels confident and professional.",
                "Casual outfit for an everyday relaxed day.",
                `SmartCasual layered outfit for today, ${getToday()}.`,
                "Streetwear look with a bold statement vibe.",
                "Athleisure outfit that blends comfort and style.",
                "Activewear outfit for performance and movement.",
                "Sportswear outfit suitable for training or activity.",
                "Winterwear outfit with warm layers and structure.",
                "Summerwear outfit that stays light and breathable.",
                "Springwear outfit for transitional weather.",
                "Autumnwear outfit with cozy layering.",
                "Rainwear outfit that stays practical and stylish.",
                "Minimalist outfit with clean lines and neutral tones.",
                "Luxury-inspired outfit with a refined aesthetic.",
                "AvantGarde outfit with an experimental fashion edge.",
                "Vintage-inspired outfit with retro influence.",
                "Traditional outfit with cultural inspiration.",
                "Cultural outfit with heritage influence.",
                "Uniform-inspired structured outfit style.",
              ]}
              className="relative z-40"
              direction="above"
            />
          </div>
        </div>
      )}

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
