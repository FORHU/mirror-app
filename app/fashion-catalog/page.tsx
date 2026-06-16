"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "../../styles/glow.css";
import {
  outfitService,
  type RemoteOutfit,
} from "@/modules/shared/api/outfit.service";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { authService } from "@/modules/shared/api/auth.service";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";
import { useQueryClient } from "@tanstack/react-query";
import { useOverviewStore } from "@/modules/overview/store/useOverviewStore";
import { ChatNavLoader } from "@/components/ChatNavLoader";
import { QuoteCarousel } from "@/components/QuoteCarousel";
import MirrorHeader from "@/components/MirrorHeader";
import { QuickResponseChips } from "@/components/QuickResponseChips";
import { OutfitImageCarousel } from "@/modules/fashion/components/OutfitImageCarousel";
import { MarqueeColumn } from "@/modules/shared/components/MarqueeColumn";
import {
  FASHION_QUOTES,
  FASHION_PROMPT_KEY,
  FASHION_DEFAULT_RECOMMENDATION_PROMPT,
  FASHION_CATEGORY_PROMPTS,
} from "@/modules/fashion/constants";

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
  Formal: ["Formal", "Business", "Luxury", "Uniform", "SmartCasual"],
};

const PAGE_SIZE = 20;

export default function FashionCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const queryClient = useQueryClient();

  const setPendingCategory = useMirrorStore((s) => s.setPendingCategory);
  const updateUser = useAuthStore((state) => state.updateUser);
  const storedGender = useAuthStore((s): "All" | "MALE" | "FEMALE" => {
    const g = s.user?.gender?.toUpperCase();
    return g === "MALE" || g === "FEMALE" ? g : "All";
  });

  const activeMainCategory = useMemo(() => {
    const metaCat = searchParams.get("metaCategory");
    if (!metaCat) return "All";
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (metaCat === val.join(",")) return key;
    }
    return "All";
  }, [searchParams]);
  const [activeGender, setActiveGender] = useState<"All" | "MALE" | "FEMALE">(
    storedGender,
  );
  const activeGenderRef = useRef<"All" | "MALE" | "FEMALE">(storedGender);
  const [isUpdatingGender, setIsUpdatingGender] = useState(false);
  const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
  const [selectedOutfitIdx, setSelectedOutfitIdx] = useState<number | null>(
    null,
  );
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(
    null,
  );
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);

  const selectedOutfit =
    selectedOutfitIdx !== null ? (outfits[selectedOutfitIdx] ?? null) : null;

  const selectedGarment = useMemo(() => {
    if (!selectedOutfit || !selectedGarmentId) return null;
    return (
      selectedOutfit.items.find((i) => i.garment.id === selectedGarmentId)
        ?.garment || null
    );
  }, [selectedOutfit, selectedGarmentId]);

  const displayImage =
    selectedGarment?.imageUrl || selectedOutfit?.file?.fileUrl;
  const displayName = selectedGarment?.name || selectedOutfit?.name;
  const displayDescription =
    selectedGarment?.description || selectedOutfit?.description;

  const [leftOutfits, rightOutfits] = (() => {
    const left: { outfit: RemoteOutfit; idx: number }[] = [];
    const right: { outfit: RemoteOutfit; idx: number }[] = [];
    outfits.forEach((outfit, idx) =>
      (idx % 2 === 0 ? left : right).push({ outfit, idx }),
    );
    return [left, right];
  })();

  // Build query with backend gender filter + pagination
  const buildQuery = useCallback((baseQuery: string, pageNum: number) => {
    const params = new URLSearchParams(baseQuery);
    params.set("limit", String(PAGE_SIZE));
    params.set("page", String(pageNum + 1)); // API is 1-indexed
    if (activeGenderRef.current !== "All") {
      params.set("metaGender", activeGenderRef.current);
    }
    return params.toString();
  }, []);

  const doFetch = useCallback(
    async (baseQuery: string, pageNum: number) => {
      setIsLoading(true);
      try {
        const fetched = await outfitService.getByQuery(
          buildQuery(baseQuery, pageNum),
        );

        setOutfits(fetched);
        setSelectedOutfitIdx(null);
      } catch (err) {
        console.error("[fashion-catalog]", err);
      } finally {
        setIsLoading(false);
      }
    },
    [buildQuery],
  );

  const localGenderChangeRef = useRef(false);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const left = leftScrollRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) return;

    let isSyncingLeft = false;
    let isSyncingRight = false;

    const handleLeftScroll = () => {
      if (!isSyncingLeft) {
        isSyncingRight = true;
        right.scrollTop = left.scrollTop;
      }
      isSyncingLeft = false;
    };

    const handleRightScroll = () => {
      if (!isSyncingRight) {
        isSyncingLeft = true;
        left.scrollTop = right.scrollTop;
      }
      isSyncingRight = false;
    };

    left.addEventListener("scroll", handleLeftScroll, { passive: true });
    right.addEventListener("scroll", handleRightScroll, { passive: true });

    return () => {
      left.removeEventListener("scroll", handleLeftScroll);
      right.removeEventListener("scroll", handleRightScroll);
    };
  }, [outfits.length, isLoading, activeMainCategory]);

  const handleGenderChange = useCallback(
    (gender: "All" | "MALE" | "FEMALE") => {
      localGenderChangeRef.current = true;
      activeGenderRef.current = gender;
      setActiveGender(gender);
      updateUser({ gender: gender !== "All" ? gender : undefined });

      // Keep overview store in sync
      const genderStr = gender === "All" ? null : gender;
      useOverviewStore.getState().setPendingGender(genderStr);

      // Clear all cached responses
      queryClient.removeQueries({ queryKey: ["chatWonder"] });

      setPage(0);
      setIsUpdatingGender(true);
      Promise.allSettled([
        authService.updateProfile({ gender: gender !== "All" ? gender : null }),
        chatWonderService.restart(),
      ]).finally(() => setIsUpdatingGender(false));
      if (!currentSearch) return;
      queueMicrotask(() => void doFetch(currentSearch, 0));
    },
    [currentSearch, doFetch, updateUser, queryClient],
  );

  // Sync filter when storedGender changes externally (e.g. from ai-assistant).
  // Skip on mount (useState already seeded from storedGender) and skip when
  // the change came from our own pills (handleGenderChange already fetched).
  const storedGenderInitRef = useRef(true);
  useEffect(() => {
    if (storedGenderInitRef.current) {
      storedGenderInitRef.current = false;
      return;
    }
    if (localGenderChangeRef.current) {
      localGenderChangeRef.current = false;
      return;
    }
    activeGenderRef.current = storedGender;
    setActiveGender(storedGender);
    setPage(0);
    if (!currentSearch) return;
    queueMicrotask(() => void doFetch(currentSearch, 0));
  }, [storedGender, currentSearch, doFetch]);

  // Reset to page 0 and fetch when URL (category) changes
  const lastSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSearchRef.current === currentSearch) return;
    lastSearchRef.current = currentSearch;
    setPage(0);
    if (!currentSearch) {
      queueMicrotask(() => setOutfits([]));
      return;
    }
    queueMicrotask(() => void doFetch(currentSearch, 0));
  }, [currentSearch, doFetch]);

  // Fetch when page changes (same category, different page)
  const prevPageRef = useRef(0);
  useEffect(() => {
    if (page === prevPageRef.current) return;
    prevPageRef.current = page;
    if (!currentSearch) return;
    queueMicrotask(() => void doFetch(currentSearch, page));
  }, [page, currentSearch, doFetch]);

  const handleRecommendationsClick = useCallback(() => {
    const metaCategory = searchParams.get("metaCategory");
    const category = metaCategory ? `metaCategory=${metaCategory}` : "ALL";
    setPendingCategory(category);
    const prompts = FASHION_CATEGORY_PROMPTS[activeMainCategory];
    let prompt = prompts
      ? prompts[Math.floor(Math.random() * prompts.length)]
      : FASHION_DEFAULT_RECOMMENDATION_PROMPT;
    if (activeGender !== "All") {
      const label = activeGender === "MALE" ? "male" : "female";
      prompt = `${prompt} Please recommend ${label} outfits only.`;
    }
    sessionStorage.setItem("mirror_fashion_category", category);
    sessionStorage.setItem(
      "mirror_fashion_gender",
      activeGender === "All" ? "null" : activeGender,
    );
    sessionStorage.setItem(FASHION_PROMPT_KEY, prompt);
    router.push("/ai-recommendation-fashion");
  }, [
    searchParams,
    setPendingCategory,
    router,
    activeMainCategory,
    activeGender,
  ]);

  const handleChipSelect = useCallback(
    (prompt: string) => {
      if (prompt === "All") {
        router.push("/fashion-catalog");
        return;
      }
      if (MAIN_CATEGORIES.includes(prompt)) {
        const sub = CATEGORY_MAP[prompt] ?? [];
        if (sub.length > 0) {
          router.push(`/fashion-catalog?metaCategory=${sub.join(",")}`);
        }
      }
    },
    [router],
  );

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
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      onClick={() => {
        setSelectedOutfitIdx(selectedOutfitIdx === idx ? null : idx);
        setSelectedGarmentId(null);
      }}
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
        background: "transparent",
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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[11px] text-white/20 pointer-events-none">
            {outfit.name}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-canvas flex flex-col">
      <ChatNavLoader />

      <MirrorHeader onBack={() => router.back()} />

      {/* Category filter tabs + gender filter */}
      {!isLoading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            padding: "6px 16px",
            flexShrink: 0,
          }}
        >
          <QuickResponseChips
            onSelect={handleChipSelect}
            prompts={MAIN_CATEGORIES}
            activePrompt={activeMainCategory}
            className="relative z-40"
            chipClassName="text-sm px-4 py-1.5"
          />
          <div className="flex items-center gap-2">
            {(["All", "MALE", "FEMALE"] as const).map((g) => (
              <button
                key={g}
                type="button"
                disabled={isUpdatingGender}
                onClick={() => handleGenderChange(g)}
                style={{
                  padding: "3px 14px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: activeGender === g ? 600 : 400,
                  letterSpacing: "0.06em",
                  color:
                    activeGender === g ? "white" : "rgba(255,255,255,0.45)",
                  background:
                    activeGender === g
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.04)",
                  border:
                    activeGender === g
                      ? "1px solid rgba(255,255,255,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                  transition: "all 0.15s ease",
                  cursor: isUpdatingGender ? "not-allowed" : "pointer",
                  opacity: isUpdatingGender ? 0.4 : 1,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span className="pointer-events-none">
                  {g === "All" ? "All" : g === "MALE" ? "Male" : "Female"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pb-2 z-10" style={{ marginTop: "-8px" }} />

      {/* Loading — cycling fashion quotes */}
      {isLoading && (
        <QuoteCarousel
          quotes={FASHION_QUOTES}
          label="Style tip"
          className="flex-1 flex flex-col items-center justify-center px-6 pt-6 pb-22 text-center"
        />
      )}

      {activeMainCategory === "All" && !isLoading && (
        <OutfitImageCarousel gender={activeGender} />
      )}

      {activeMainCategory !== "All" && !isLoading && outfits.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-10 text-center">
          <p className="text-white/40 text-sm font-light leading-relaxed tracking-wide">
            There is no outfit currently out in our drawer for the current
            weather and condition.
          </p>
        </div>
      )}

      {activeMainCategory !== "All" && !isLoading && outfits.length > 0 && (
        <div className="flex flex-1 min-h-0 w-full">
          {/* Left column */}
          <div
            className="h-full flex flex-col p-2 gap-2 min-h-0"
            style={{ flex: "0 0 20%", width: "20%" }}
          >
            <MarqueeColumn
              loop={false}
              gap={6}
              style={{ touchAction: "pan-y" }}
              scrollRef={leftScrollRef}
            >
              {leftOutfits.map(renderOutfitCard)}
            </MarqueeColumn>
          </div>

          {/* Center — selected outfit detail */}
          <div
            className="h-full flex flex-col items-center overflow-hidden"
            style={{ flex: "1 1 0", minWidth: 0, minHeight: 0 }}
          >
            {selectedOutfit && (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  width: "100%",
                  padding: "10px 8px 120px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  overflow: "hidden",
                  background: "transparent",
                }}
              >
                <div
                  className="group"
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "48vh",
                    borderRadius: "12px",
                    background: "transparent",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {displayImage ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayImage}
                        alt={displayName}
                        draggable={false}
                        onClick={() => setIsFullViewOpen(true)}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          objectPosition: "bottom center",
                          display: "block",
                          cursor: "zoom-in",
                        }}
                      />
                      <button
                        onClick={() => setIsFullViewOpen(true)}
                        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-white/90 active:bg-black/60 transition-all duration-200 shadow-lg backdrop-blur-md"
                        style={{ touchAction: "manipulation" }}
                        title="Full Screen"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <polyline points="9 21 3 21 3 15"></polyline>
                          <line x1="21" y1="3" x2="14" y2="10"></line>
                          <line x1="3" y1="21" x2="10" y2="14"></line>
                        </svg>
                      </button>
                    </>
                  ) : (
                    <span className="text-white/25 text-xs uppercase tracking-[0.18em]">
                      Outfit
                    </span>
                  )}
                </div>

                <div className="shrink-0">
                  <div className="text-white font-semibold text-sm leading-tight">
                    {displayName}
                  </div>
                  {displayDescription && (
                    <div className="text-white/40 text-xs leading-snug mt-1">
                      {displayDescription}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    WebkitOverflowScrolling: "touch",
                    touchAction: "pan-y",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    paddingRight: "4px",
                  }}
                >
                  {selectedOutfit.items.map((item) => {
                    const g = item.garment;
                    const isSelected = selectedGarmentId === g.id;
                    return (
                      <div
                        key={g.id}
                        onClick={() => setSelectedGarmentId(g.id)}
                        className="transition-all cursor-pointer"
                        style={{
                          flex: "0 0 auto",
                          minHeight: "76px",
                          background: isSelected
                            ? "rgba(255,255,255,0.08)"
                            : "transparent",
                          border: isSelected
                            ? "1px solid rgba(255,255,255,0.2)"
                            : "1px solid transparent",
                          borderRadius: "12px",
                          display: "flex",
                          alignItems: "center",
                          padding: "10px",
                          gap: "12px",
                          touchAction: "manipulation",
                        }}
                      >
                        <div
                          style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "8px",
                            background: "transparent",
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
                            gap: "4px",
                          }}
                        >
                          <span
                            style={{
                              color: "rgba(255,255,255,0.4)",
                              fontSize: "9px",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
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

                {/* Recommendations button fixed at the bottom of the center column */}
                <div className="w-full flex flex-col items-center shrink-0 pointer-events-auto mt-2">
                  <div className="w-full flex justify-center mb-6">
                    <button
                      onClick={handleRecommendationsClick}
                      disabled={isUpdatingGender}
                      className="flex items-center justify-center gap-2 px-5 py-3 w-full max-w-xs rounded-full text-sm font-medium text-white transition-opacity"
                      style={{
                        background: "rgba(255,255,255,0.12)",
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        opacity: isUpdatingGender ? 0.4 : 1,
                        cursor: isUpdatingGender ? "not-allowed" : "pointer",
                        touchAction: "manipulation",
                      }}
                    >
                      <span className="pointer-events-none">
                        Ask AI for Recommendation
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div
            className="h-full flex flex-col p-2 gap-2 min-h-0"
            style={{ flex: "0 0 20%", width: "20%" }}
          >
            <MarqueeColumn
              loop={false}
              gap={6}
              style={{ touchAction: "pan-y" }}
              scrollRef={rightScrollRef}
            >
              {rightOutfits.map(renderOutfitCard)}
            </MarqueeColumn>
          </div>
        </div>
      )}

      {/* Full View Modal */}
      {isFullViewOpen && displayImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md cursor-zoom-out transition-all duration-300"
          onClick={() => setIsFullViewOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt={displayName}
            style={{
              maxWidth: "92vw",
              maxHeight: "92vh",
              objectFit: "contain",
              borderRadius: "16px",
              boxShadow: "0 0 60px rgba(0,0,0,0.5)",
            }}
          />
          <button
            className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors text-xl font-light"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullViewOpen(false);
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
