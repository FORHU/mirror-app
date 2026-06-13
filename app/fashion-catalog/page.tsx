"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "../../styles/glow.css";
import {
  outfitService,
  type RemoteOutfit,
} from "@/modules/shared/api/outfit.service";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
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
  Formal: ["Formal", "Business", "SmartCasual", "Luxury", "Uniform"],
};

const PAGE_SIZE = 20;

function normalizeGender(value: unknown): "MALE" | "FEMALE" | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  if (["MALE", "MAN", "MEN", "M"].includes(v)) return "MALE";
  if (["FEMALE", "WOMAN", "WOMEN", "F"].includes(v)) return "FEMALE";
  return null;
}

export default function FashionCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();

  const setPendingCategory = useMirrorStore((s) => s.setPendingCategory);
  const userGender = useAuthStore((state) => state.user?.gender);

  const [activeMainCategory, setActiveMainCategory] = useState("All");
  const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
  const [selectedOutfitIdx, setSelectedOutfitIdx] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const selectedOutfit = selectedOutfitIdx !== null ? (outfits[selectedOutfitIdx] ?? null) : null;

  const [leftOutfits, rightOutfits] = (() => {
    const left: { outfit: RemoteOutfit; idx: number }[] = [];
    const right: { outfit: RemoteOutfit; idx: number }[] = [];
    outfits.forEach((outfit, idx) =>
      (idx % 2 === 0 ? left : right).push({ outfit, idx }),
    );
    return [left, right];
  })();

  // Build query with backend gender filter + pagination
  const buildQuery = useCallback(
    (baseQuery: string, pageNum: number) => {
      const params = new URLSearchParams(baseQuery);
      params.set("limit", String(PAGE_SIZE));
      params.set("page", String(pageNum + 1)); // API is 1-indexed
      const gender = normalizeGender(userGender);
      if (gender) params.set("gender", gender);
      return params.toString();
    },
    [userGender],
  );

  const doFetch = useCallback(
    async (baseQuery: string, pageNum: number) => {
      setIsLoading(true);
      try {
        const fetched = await outfitService.getByQuery(
          buildQuery(baseQuery, pageNum),
        );
        setOutfits(fetched);
        setHasMore(fetched.length >= PAGE_SIZE);
        setSelectedOutfitIdx(null);
      } catch (err) {
        console.error("[fashion-catalog]", err);
      } finally {
        setIsLoading(false);
      }
    },
    [buildQuery],
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSearch]);

  // Fetch when page changes (same category, different page)
  const prevPageRef = useRef(0);
  useEffect(() => {
    if (page === prevPageRef.current) return;
    prevPageRef.current = page;
    if (!currentSearch) return;
    queueMicrotask(() => void doFetch(currentSearch, page));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleRecommendationsClick = useCallback(() => {
    const metaCategory = searchParams.get("metaCategory");
    const category = metaCategory ? `metaCategory=${metaCategory}` : "ALL";
    setPendingCategory(category);
    const prompts = FASHION_CATEGORY_PROMPTS[activeMainCategory];
    const prompt = prompts
      ? prompts[Math.floor(Math.random() * prompts.length)]
      : FASHION_DEFAULT_RECOMMENDATION_PROMPT;
    sessionStorage.setItem(FASHION_PROMPT_KEY, prompt);
    router.push("/ai-recommendation-fashion");
  }, [searchParams, setPendingCategory, router, activeMainCategory]);

  const handleChipSelect = useCallback(
    (prompt: string) => {
      if (prompt === "All") {
        setActiveMainCategory("All");
        router.push("/fashion-catalog");
        return;
      }
      if (MAIN_CATEGORIES.includes(prompt)) {
        setActiveMainCategory(prompt);
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
      onClick={() =>
        setSelectedOutfitIdx(selectedOutfitIdx === idx ? null : idx)
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-canvas flex flex-col">
      <ChatNavLoader />

      <MirrorHeader onBack={() => router.back()} />

      {/* Category filter tabs */}
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

      <div className="px-4 pb-2 z-10" style={{ marginTop: "-8px" }} />

      {/* Loading — cycling fashion quotes */}
      {isLoading && (
        <QuoteCarousel
          quotes={FASHION_QUOTES}
          label="Style tip"
          className="flex-1 flex flex-col items-center justify-center px-6 pt-6 pb-22 text-center"
        />
      )}

      {activeMainCategory === "All" && !isLoading && <OutfitImageCarousel />}

      {activeMainCategory !== "All" && !isLoading && outfits.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-10 text-center">
          <p className="text-white/40 text-sm font-light leading-relaxed tracking-wide">
            There is no outfit currently out in our drawer for the current weather and condition.
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
            <MarqueeColumn loop={false} gap={6} style={{ touchAction: "pan-y" }}>
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
                  padding: "10px 8px 176px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  overflow: "auto",
                  scrollPaddingBottom: "180px",
                  background: "transparent",
                }}
              >
                <div
                  style={{
                    flex: "1 1 auto",
                    minHeight: "min(58vh, 620px)",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {selectedOutfit.file?.fileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedOutfit.file.fileUrl}
                      alt={selectedOutfit.name}
                      draggable={false}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <span className="text-white/25 text-xs uppercase tracking-[0.18em]">
                      Outfit
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-white font-semibold text-sm leading-tight">
                    {selectedOutfit.name}
                  </div>
                  {selectedOutfit.description && (
                    <div className="text-white/45 text-xs leading-snug mt-1">
                      {selectedOutfit.description}
                    </div>
                  )}
                </div>

                {selectedOutfit.items.map((item) => {
                  const g = item.garment;
                  return (
                    <div
                      key={g.id}
                      style={{
                        flex: "0 0 auto",
                        minHeight: "76px",
                        background: "rgba(255,255,255,0.06)",
                        backdropFilter: "blur(12px)",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        padding: "10px",
                        border: "1px solid rgba(255,255,255,0.08)",
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
                            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
                          />
                        ) : (
                          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "9px" }}>
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
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          {g.layerLevel ?? g.garmentType[0]}
                        </span>
                        <span style={{ color: "white", fontSize: "12px", fontWeight: 600, lineHeight: 1.3 }}>
                          {g.name}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", lineHeight: 1.4 }}>
                          {g.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div
            className="h-full flex flex-col p-2 gap-2 min-h-0"
            style={{ flex: "0 0 20%", width: "20%" }}
          >
            <MarqueeColumn loop={false} gap={6} style={{ touchAction: "pan-y" }}>
              {rightOutfits.map(renderOutfitCard)}
            </MarqueeColumn>
          </div>
        </div>
      )}

      {/* Bottom action row */}
      {!isLoading && (
        <div className="absolute bottom-25 left-0 right-0 z-40 flex flex-col items-center gap-3 px-4 pointer-events-none">
          {/* Pagination */}
          {activeMainCategory !== "All" && outfits.length > 0 && (
            <div className="pointer-events-auto flex items-center gap-6">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="tap-highlight-none focus:outline-none disabled:opacity-25 transition-opacity"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <span className="text-white/60 uppercase tracking-[0.2em] text-[11px]">← Prev</span>
              </button>
              <span className="text-white/35 text-[11px] tracking-[0.2em] uppercase tabular-nums">
                Page {page + 1}
              </span>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="tap-highlight-none focus:outline-none disabled:opacity-25 transition-opacity"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <span className="text-white/60 uppercase tracking-[0.2em] text-[11px]">Next →</span>
              </button>
            </div>
          )}

          {/* Recommendations button */}
          <div className="pointer-events-auto">
            <button
              onClick={handleRecommendationsClick}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.25)",
                backdropFilter: "blur(12px)",
              }}
            >
              Recommendations
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
