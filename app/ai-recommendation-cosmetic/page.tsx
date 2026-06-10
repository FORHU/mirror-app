"use client";

import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/navigation";
import { useVoice } from "@/modules/shared/voice/useVoice";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { CosmeticGrid } from "@/modules/cosmetics/components/CosmeticGrid";
import { COSMETIC_PROMPT_KEY } from "@/modules/cosmetics/constants";
import type { SkinRecommendation } from "@/modules/shared/api/cosmetics.service";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import MirrorHeader from "@/components/MirrorHeader";
import { getToday, nextWeekday } from "@/components/QuickResponseChips";
import { PromptFloater } from "@/components/PromptFloater";
import { ChatNavLoader } from "@/components/ChatNavLoader";
import { QuoteCarousel } from "@/components/QuoteCarousel";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function normalizeRecommendation(
  raw: unknown,
  index: number,
): SkinRecommendation | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const product = asRecord(rec.cosmeticProduct);
  const productFile = asRecord(product?.fileUrl);
  const id =
    str(rec.id) ||
    str(rec.productId) ||
    str(rec.cosmeticProductId) ||
    str(product?.id) ||
    `cosmetic-${index}`;
  const name =
    str(product?.name) ||
    str(rec.name) ||
    str(rec.productName) ||
    str(rec.product_name) ||
    "Unknown Product";
  const brand =
    str(product?.brand) ||
    str(rec.brand) ||
    str(rec.brandName) ||
    str(rec.brand_name) ||
    null;
  const imageUrl =
    str(productFile?.fileUrl) ||
    str(productFile?.thumbnailUrl) ||
    str(rec.imageUrl) ||
    str(rec.image_url) ||
    str(rec.image);
  const rawTags = Array.isArray(product?.tags)
    ? product.tags
    : Array.isArray(rec.tags)
      ? rec.tags
      : [];

  return {
    id,
    rank: num(rec.rank, index + 1),
    score: num(rec.score, 0),
    reason:
      str(rec.reason) ||
      str(rec.description) ||
      "Recommended for your profile.",
    cosmeticProduct: {
      id: str(product?.id) || id,
      name,
      brand,
      category: str(product?.category) || str(rec.category) || null,
      type: str(product?.type) || str(rec.type) || null,
      tags: rawTags.map(String),
      benefits: Array.isArray(product?.benefits)
        ? product.benefits.map(String)
        : Array.isArray(rec.benefits)
          ? rec.benefits.map(String)
          : [],
      fileUrl: imageUrl ? { fileUrl: imageUrl } : null,
    },
  };
}

const COSMETIC_QUOTES = [
  {
    text: "Beauty begins the moment you decide to be yourself.",
    author: "Coco Chanel",
  },
  {
    text: "Invest in your skin. It is going to represent you for a very long time.",
    author: "Linden Tyler",
  },
  {
    text: "Healthy skin is a reflection of overall wellness.",
    author: "Dr. Howard Murad",
  },
  {
    text: "Take care of your body. It's the only place you have to live.",
    author: "Jim Rohn",
  },
  {
    text: "Confidence is the best foundation you can wear.",
    author: "Unknown",
  },
  {
    text: "Glow comes from within, but a good routine never hurts.",
    author: "Unknown",
  },
];

export default function CosmeticRecommendationPage() {
  const router = useRouter();
  const skinAnalysisResult = useMirrorStore((s) => s.skinAnalysisResult);
  const pendingCosmeticsData = useMirrorStore((s) => s.pendingCosmeticsData);
  const aiSuggestion = useMirrorStore((s) => s.aiSuggestion);
  const chatCosmeticsData = useMirrorStore((s) => s.chatCosmeticsData);
  const handoffStartedRef = useRef(false);
  const [isHandoffLoading, setIsHandoffLoading] = useState(() =>
    typeof window !== "undefined"
      ? Boolean(sessionStorage.getItem(COSMETIC_PROMPT_KEY))
      : false,
  );

  const pageContext = useMemo(
    () => ({
      route: ROUTES.AI_RECOMMENDATION_COSMETIC,
      pageName: "Cosmetic Recommendations",
      activeStep: "reviewing_products",
      mode: "cosmetics" as const,
    }),
    [],
  );

  // Consume cosmetics data from the chat-path nav_early flow (ChatWonderProvider).
  useEffect(() => {
    if (!chatCosmeticsData) return;
    useMirrorStore.getState().setChatCosmeticsData(null);
    useMirrorStore.getState().setPendingCosmeticsData(chatCosmeticsData);
  }, [chatCosmeticsData]);

  const rawRecs = useMemo(() => {
    if (isHandoffLoading && !pendingCosmeticsData) return [];

    if (pendingCosmeticsData) {
      const data = pendingCosmeticsData as {
        recommendations?: unknown[];
        sets?: Array<{ recommendations?: unknown[] }>;
      };
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.recommendations)) return data.recommendations;
      if (Array.isArray(data.sets))
        return data.sets.flatMap(
          (s: { recommendations?: unknown[] }) => s.recommendations || [],
        );
    }
    return skinAnalysisResult?.recommendations || [];
  }, [isHandoffLoading, pendingCosmeticsData, skinAnalysisResult]);

  const allRecs = useMemo(
    () =>
      rawRecs
        .map((rec, index) => normalizeRecommendation(rec, index))
        .filter((rec): rec is SkinRecommendation => Boolean(rec)),
    [rawRecs],
  );

  // Sort recommendations by rank
  const sortedRecs = useMemo(() => {
    return [...allRecs].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  }, [allRecs]);

  // The design requests 10 items total, split 5 on left, 5 on right.
  const leftColRecs = sortedRecs.slice(0, 5);
  const rightColRecs = sortedRecs.slice(5, 10);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Derive the active recommendation during render (defaults to the top rank)
  // instead of syncing it via an effect, which triggers cascading renders.
  const selectedRec = useMemo<SkinRecommendation | null>(() => {
    if (!sortedRecs.length) return null;
    return sortedRecs.find((rec) => rec.id === selectedId) ?? sortedRecs[0];
  }, [selectedId, sortedRecs]);

  const handleVoiceAction = useCallback(
    (action: ChatWonderAction) => {
      if (action.type !== "cosmetic_select_recommendation") return;

      const selected =
        sortedRecs.find((rec) => rec.rank === action.rank) ??
        sortedRecs[action.rank - 1];
      if (selected) setSelectedId(selected.id);
    },
    [sortedRecs],
  );

  useVoice(pageContext, handleVoiceAction);
  const { submitText, isProcessing } = useVoiceContext();

  useEffect(() => {
    if (handoffStartedRef.current) return;

    const prompt = sessionStorage.getItem(COSMETIC_PROMPT_KEY);
    if (!prompt) return;

    handoffStartedRef.current = true;
    sessionStorage.removeItem(COSMETIC_PROMPT_KEY);
    // isHandoffLoading is already true from the useState initializer (same key),
    // so no synchronous setState is needed here.
    void submitText(prompt)
      .catch((err) => {
        console.error("[cosmetics-handoff]", err);
      })
      .finally(() => {
        setIsHandoffLoading(false);
      });
  }, [submitText]);

  const isLoadingRecommendations =
    isHandoffLoading || (!pendingCosmeticsData && !skinAnalysisResult);
  const showRecommendationSkeletons = isLoadingRecommendations || isProcessing;
  // Show the cycling quotes whenever the AI is talking (overrides the product /
  // skin-profile view) or while nothing has loaded yet.
  const showQuotes = isProcessing || (!selectedRec && !skinAnalysisResult);

  return (
    <div
      className="w-full h-full relative overflow-hidden text-white flex flex-col"
      style={{
        fontFamily: "sans-serif",
        touchAction: "none",
        background: "oklch(0.035 0.004 260)",
      }}
    >
      <ChatNavLoader spinnerColor="white" />

      <MirrorHeader
        className="w-full relative z-10"
        style={{ background: "transparent" }}
        onBack={() => router.back()}
      />

      {/* Main 3 Column Layout */}
      <div className="flex-1 min-h-0 flex w-full h-full p-4 gap-7 pt-2">
        {/* Left Column - Recommendations 1-5 */}
        <div className="flex min-h-0 flex-col w-[30%] h-full overflow-hidden">
          <CosmeticGrid
            label="Daily Essentials"
            pagedItems={leftColRecs}
            loading={showRecommendationSkeletons}
            pageSize={5}
            columns={1}
            selectedId={selectedRec?.id}
            onSelect={(rec) => setSelectedId(rec.id)}
            emptyMessage="No products available."
          />
        </div>

        {/* Center Column - Evaluation/Details */}
        <div className="flex-1 h-full flex flex-col items-center justify-center p-4 relative">
          <div className="w-full h-full max-w-none flex flex-col items-center">
            <div className="flex flex-col justify-center">
              {!showQuotes && selectedRec ? (
                <div className="relative flex flex-col items-center text-center px-6 py-2 transition-all duration-300">
                  <div
                    className="relative flex shrink-0 items-center justify-center"
                    style={{
                      width: "min(38vw, 460px)",
                      height: "min(42vh, 500px)",
                      maxWidth: "none",
                    }}
                  >
                    {selectedRec.cosmeticProduct?.fileUrl?.fileUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedRec.cosmeticProduct.fileUrl.fileUrl}
                        alt={selectedRec.cosmeticProduct?.name || "Product"}
                        decoding="async"
                        className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.62)]"
                        style={{ filter: "none", opacity: 1 }}
                      />
                    ) : (
                      <span className="relative z-10 text-white/20 text-xs uppercase tracking-widest">
                        No Image
                      </span>
                    )}
                  </div>

                  <div className="max-w-md">
                    <div className="text-[11px] text-white/45 uppercase tracking-[0.24em] mb-1.5 font-semibold">
                      {selectedRec.cosmeticProduct?.brand || "Curated Brand"}
                    </div>
                    <h2 className="text-2xl font-light leading-tight mb-3 text-white/90">
                      {selectedRec.cosmeticProduct?.name || "Unknown Product"}
                    </h2>
                    <p className="text-[14px] text-white/52 leading-relaxed font-light">
                      {selectedRec.reason}
                    </p>
                  </div>
                </div>
              ) : !showQuotes && skinAnalysisResult ? (
                <div className="px-8 py-4 transition-all duration-500">
                  <h2 className="text-3xl font-light mb-2 text-white/88">
                    Skin Profile
                  </h2>

                  <div className="space-y-6">
                    <div>
                      <div className="text-xs text-white/40 uppercase tracking-widest mb-1.5">
                        Detected Type
                      </div>
                      <div className="text-2xl font-light text-white/90 capitalize">
                        {skinAnalysisResult.skinType} Skin
                      </div>
                    </div>

                    {skinAnalysisResult.concerns.length > 0 && (
                      <div>
                        <div className="text-xs text-white/40 uppercase tracking-widest mb-3">
                          Key Concerns
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {skinAnalysisResult.concerns.map((c) => (
                            <span
                              key={c}
                              className="px-2.5 py-1 text-white/55 text-xs uppercase font-medium tracking-wider"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {skinAnalysisResult.routineTip && (
                      <div className="mt-8 pt-6">
                        <div className="text-xs text-white/40 uppercase tracking-widest mb-3 font-semibold">
                          AI Routine Tip
                        </div>
                        <p className="text-base text-white/60 leading-relaxed italic font-light">
                          &quot;{skinAnalysisResult.routineTip}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <QuoteCarousel
                  quotes={COSMETIC_QUOTES}
                  label="Skin Tip"
                  labelClassName="text-white/30"
                  className="flex flex-col items-center justify-center p-12 text-center"
                />
              )}
            </div>

            {aiSuggestion && (
              <div className="mt-6 px-5 shrink-0">
                <p className="text-[14px] text-white/58 italic leading-relaxed font-light">
                  &quot;{aiSuggestion}&quot;
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Recommendations 6-10 */}
        <div className="flex min-h-0 flex-col w-[30%] h-full overflow-hidden">
          <CosmeticGrid
            label="Targeted Treatments"
            pagedItems={rightColRecs}
            loading={showRecommendationSkeletons}
            pageSize={5}
            columns={1}
            selectedId={selectedRec?.id}
            onSelect={(rec) => setSelectedId(rec.id)}
            emptyMessage="No more products"
          />
        </div>
      </div>

      <PromptFloater
        prompts={[
          `Recommend a morning skincare routine for today, ${getToday()}, based on my skin analysis.`,
          `I have an important event on ${nextWeekday(1)} — what products should I use for a fresh, polished look?`,
          "What are the top products I should use right now to address my main skin concerns?",
          "Suggest a calming evening routine I can follow tonight to repair and hydrate my skin.",
          "I want to visibly improve my skin's texture and glow over the next 30 days — build me a product plan.",
        ]}
      />
    </div>
  );
}
