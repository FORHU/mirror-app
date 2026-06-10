"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "../../styles/glow.css";
import type { RemoteGarment } from "@/modules/shared/api/garment.service";
import type { RemoteOutfit } from "@/modules/shared/api/outfit.service";
import type { ChatWonderMessageResponse } from "@/modules/shared/api/chat-wonder.service";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { useVoice } from "@/modules/shared/voice/useVoice";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import { ChatNavLoader } from "@/components/ChatNavLoader";
import { QuoteCarousel } from "@/components/QuoteCarousel";
import MirrorHeader from "@/components/MirrorHeader";
import { getToday } from "@/components/QuickResponseChips";
import { PromptFloater } from "@/components/PromptFloater";
import { OutfitPreviewModal } from "@/modules/fashion/components/OutfitPreviewModal";
import { OutfitListPanel } from "@/modules/fashion/components/OutfitListPanel";
import {
  GarmentSelectionPanel,
  type GarmentSlotConfig,
} from "@/modules/fashion/components/GarmentSelectionPanel";
import { OutfitImageCarousel } from "@/modules/fashion/components/OutfitImageCarousel";
import type { SwapSlot } from "@/modules/fashion/types";
import { useSwipe } from "@/modules/fashion/hooks/useSwipe";
import { FASHION_QUOTES } from "@/modules/fashion/constants";
import type { OutfitPreviewCanvasHandle } from "@/components/OutfitPreviewCanvas";

function CreateOutfitFloaterButton({
  hasSelection,
  label,
  onPress,
}: {
  hasSelection: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <div className="fixed bottom-[160px] left-1/2 -translate-x-1/2 z-40">
      <button
        type="button"
        onClick={onPress}
        className="flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl whitespace-nowrap"
        style={{
          background: hasSelection
            ? "rgba(79,195,247,0.18)"
            : "rgba(20,20,30,0.85)",
          border: hasSelection
            ? "1.5px solid rgba(79,195,247,0.6)"
            : "1.5px solid rgba(255,255,255,0.15)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <span className="text-white/80 text-[11px] font-medium uppercase tracking-[0.18em]">
          {label}
        </span>
      </button>
    </div>
  );
}

export default function VirtualMirrorV2() {
  const router = useRouter();
  const chatGarmentData = useMirrorStore((s) => s.chatGarmentData);
  const { isProcessing } = useVoiceContext();

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
    setSwapSlot(null);
    setSwapItemId(null);
  }

  function cancelSwap() {
    setSwapSlot(null);
    setSwapItemId(null);
  }

  const clearSlots = () => {
    setSelectedBag(null);
    setSelectedTopBase(null);
    setSelectedTopMid(null);
    setSelectedTopOuter(null);
    setSelectedBottom(null);
    setSelectedShoe(null);
  };
  const selectOutfit = (idx: number) => {
    setSelectedOutfitIdx(idx);
    clearSlots();
    setOutfitOverrides({});
    setSwapSlot(null);
    setSwapItemId(null);
  };

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
  const accessoryPageSize = 6;
  const topsLayerPageSize = 2;

  const [topsBase, setTopsBase] = useState<RemoteGarment[]>([]);
  const [topsMid, setTopsMid] = useState<RemoteGarment[]>([]);
  const [topsOuter, setTopsOuter] = useState<RemoteGarment[]>([]);

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

  const totalTopsBasePages = Math.ceil(
    filteredTopsBase.length / topsLayerPageSize,
  );
  const totalTopsMidPages = Math.ceil(
    filteredTopsMid.length / topsLayerPageSize,
  );
  const totalTopsOuterPages = Math.ceil(
    filteredTopsOuter.length / topsLayerPageSize,
  );

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
  const totalShoesPages = Math.ceil(filteredShoes.length / shoesPageSize);
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
  const totalBottomsPages = Math.ceil(filteredBottoms.length / bottomsPageSize);
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
  const totalBagsPages = Math.ceil(filteredBags.length / accessoryPageSize);
  const pagedBags = filteredBags.slice(
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

      // ── /message format: response.garment_data.sets[].recommendations[] ────────
      const sets = response.garment_data?.sets ?? [];
      for (const s of sets) {
        for (const r of (s.recommendations ?? []) as AiItem[]) {
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

      const seenOutfitIds = new Set<string>();
      const newAiOutfits: RemoteOutfit[] = sets
        .filter((s) => s.outfit_imageUrl)
        .map((s, i) => {
          const baseId = s.outfit_id || `outfit-${i}`;
          const id = seenOutfitIds.has(baseId) ? `${baseId}-${i}` : baseId;
          seenOutfitIds.add(id);
          return {
            id,
            name: s.outfit_name,
            description: s.reason,
            file: { fileUrl: s.outfit_imageUrl },
            items: s.recommendations.map((r) => ({
              id: r.id,
              slot: r.fittingSlot[0] ?? "UpperGarment",
              garment: {
                id: r.id,
                name: r.name,
                description: r.description,
                imageUrl: r.imageUrl,
                garmentType: r.garmentType,
                fittingSlot: r.fittingSlot,
              },
            })),
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

  // Consume garment data forwarded from /ai-assistant via useMirrorStore.
  useEffect(() => {
    const pending = useMirrorStore.getState().pendingGarmentData;
    if (!pending) return;
    useMirrorStore.getState().setPendingGarmentData(null);

    handleAiComplete({ garment_data: pending } as ChatWonderMessageResponse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume garment data from the chat-path nav_early flow (ChatWonderProvider).
  useEffect(() => {
    if (!chatGarmentData) return;
    useMirrorStore.getState().setChatGarmentData(null);

    handleAiComplete({
      garment_data: chatGarmentData,
    } as ChatWonderMessageResponse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatGarmentData]);

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
      items: topsBase,
      pagedItems: pagedTopsBase,
      pageSize: topsLayerPageSize,
      currentPage: topsBasePage,
      totalPages: totalTopsBasePages,
      onPageChange: setTopsBasePage,
      selectedId: selectedTopBase?.id,
      emptyMessage: "No recommended Base",
    },
    {
      key: "mid",
      label: "Mid",
      items: topsMid,
      pagedItems: pagedTopsMid,
      pageSize: topsLayerPageSize,
      currentPage: topsMidPage,
      totalPages: totalTopsMidPages,
      onPageChange: setTopsMidPage,
      selectedId: selectedTopMid?.id,
      emptyMessage: "No recommended Mid",
    },
    {
      key: "outer",
      label: "Outer",
      items: topsOuter,
      pagedItems: pagedTopsOuter,
      pageSize: topsLayerPageSize,
      currentPage: topsOuterPage,
      totalPages: totalTopsOuterPages,
      onPageChange: setTopsOuterPage,
      selectedId: selectedTopOuter?.id,
      emptyMessage: "No recommended Outer",
    },
    {
      key: "bottoms",
      label: "Bottoms",
      items: bottoms,
      pagedItems: pagedBottoms,
      pageSize: bottomsPageSize,
      currentPage: bottomsPage,
      totalPages: totalBottomsPages,
      onPageChange: setBottomsPage,
      selectedId: selectedBottom?.id,
      emptyMessage: "No recommended Bottoms",
    },
    {
      key: "shoes",
      label: "Shoes",
      items: shoes,
      pagedItems: pagedShoes,
      pageSize: shoesPageSize,
      currentPage: shoesPage,
      totalPages: totalShoesPages,
      onPageChange: setShoesPage,
      selectedId: selectedShoe?.id,
      emptyMessage: "No recommended Shoes",
    },
    {
      key: "bags",
      label: "Bags",
      items: bags,
      pagedItems: pagedBags,
      pageSize: accessoryPageSize,
      currentPage: bagsPage,
      totalPages: totalBagsPages,
      onPageChange: setBagsPage,
      selectedId: selectedBag?.id,
      columns: 3,
      emptyMessage: "No recommended Bags",
    },
  ];

  // Idle showcase: nothing recommended yet and not mid-request → run the
  // outfit image carousel so the screen isn't just black.
  const hasRecommendations =
    outfits.length > 0 ||
    topsBase.length > 0 ||
    topsMid.length > 0 ||
    topsOuter.length > 0 ||
    bottoms.length > 0 ||
    shoes.length > 0 ||
    bags.length > 0;
  const showShowcase = !hasRecommendations && !isProcessing;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      <ChatNavLoader />

      <MirrorHeader onBack={() => router.back()} />

      {/* AI Suggestion Banner */}
      <div className="px-4 pb-2 z-10" style={{ marginTop: "-8px" }} />

      {/* Idle showcase — outfit image carousel fills the black space until the
          user has recommendations (sits behind the prompts/mic). */}
      {showShowcase && (
        <div
          className="absolute inset-x-0 z-0 px-6"
          style={{ top: 80, bottom: 170 }}
        >
          <OutfitImageCarousel />
        </div>
      )}

      <div className="flex flex-1" style={{ height: "546px" }}>
        {/* Left panel — recommended outfit list */}
        <OutfitListPanel
          outfits={outfits}
          pagedOutfits={pagedOutfits}
          outfitPage={outfitPage}
          outfitPageSize={outfitPageSize}
          totalOutfitPages={totalOutfitPages}
          selectedOutfitIdx={selectedOutfitIdx}
          isProcessing={isProcessing}
          swipeHandlers={outfitSwipe}
          onSelect={selectOutfit}
          onPageChange={setOutfitPage}
        />

        {/* Center panel */}
        {(() => {
          const selectedOutfit =
            selectedOutfitIdx !== null
              ? (outfits[selectedOutfitIdx] ?? null)
              : null;
          return (
            <div
              className="h-full flex flex-col items-center pt-8 gap-1 overflow-hidden"
              style={{ flex: "0 0 50%", width: "50%", minHeight: 0 }}
            >
              {/* Outfit display */}
              {selectedOutfit && !isProcessing && (
                <div
                  style={{
                    width: "100%",
                    padding: "0 12px",
                    paddingBottom: "145px",
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
                      flex: "2 1 0",
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
                      gap: "3px",
                    }}
                  >
                    <span
                      style={{
                        color: "white",
                        fontSize: "13px",
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
                          color: "rgba(255,255,255,0.5)",
                          fontSize: "10px",
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
                              className="flex"
                              onClick={() => {
                                const slot = resolveSwapSlot(
                                  item.garment.garmentType,
                                  item.garment.fittingSlot,
                                );
                                if (isSwapping) {
                                  cancelSwap();
                                  return;
                                }
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
              {isProcessing && (
                <QuoteCarousel
                  quotes={FASHION_QUOTES}
                  label="Style tip"
                  className="flex-1 flex flex-col items-center justify-center px-6 pt-6 pb-[88px] text-center"
                />
              )}

              {/* Garment slot cards */}
              {!selectedOutfit && !isProcessing && (
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
                              fontSize: "10px",
                              lineHeight: 1.4,
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
        <GarmentSelectionPanel
          slots={garmentSlots}
          swapSlot={swapSlot}
          isProcessing={isProcessing}
          onCancelSwap={cancelSwap}
          onSelect={handleSlotSelect}
        />
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

      {/* Create Outfit — fixed above the Suggestions floater, hidden during voice */}
      {!isProcessing && (
        <CreateOutfitFloaterButton
          hasSelection={
            selectedOutfitIdx !== null ||
            outfitModified ||
            !!(
              (selectedTopBase || selectedTopMid || selectedTopOuter) &&
              selectedBottom &&
              selectedShoe
            )
          }
          label={
            outfitModified
              ? "Customize Outfit"
              : selectedOutfitIdx !== null
                ? "Generate Look"
                : "Create Outfit"
          }
          onPress={() => setShowConfirm(true)}
        />
      )}

      {/* Suggested prompts — collapsible floater centered above the mic */}
      <PromptFloater
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
      />
    </div>
  );
}
