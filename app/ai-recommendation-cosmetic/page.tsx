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
import { ChatNavLoader } from "@/components/ChatNavLoader";

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
      str(rec.reason) || str(rec.description) || "Recommended for your profile.",
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

  const { isListening } = useVoice(pageContext, handleVoiceAction);
  const { submitText } = useVoiceContext();

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

  return (
    <div
      className="w-full h-full relative overflow-hidden bg-black text-white flex flex-col"
      style={{ fontFamily: "sans-serif", touchAction: "none" }}
    >
      <ChatNavLoader spinnerColor="pink" />

      <MirrorHeader
        className="w-full relative z-10"
        style={{ background: "transparent" }}
        onBack={() => router.back()}
        isListening={isListening}
      />

      {/* Main 3 Column Layout */}
      <div className="flex-1 flex w-full h-full p-4 gap-6 pt-2">
        {/* Left Column - Recommendations 1-5 */}
        <div className="flex flex-col w-[28%] h-full overflow-hidden">
          <CosmeticGrid
            label="Daily Essentials"
            pagedItems={leftColRecs}
            loading={isLoadingRecommendations}
            pageSize={5}
            columns={1}
            selectedId={selectedRec?.id}
            onSelect={(rec) => setSelectedId(rec.id)}
            emptyMessage="No products available."
          />
        </div>

        {/* Center Column - Evaluation/Details */}
        <div className="flex-1 h-full flex flex-col items-center justify-center p-6 relative">
          <div className="w-full h-full max-w-lg flex flex-col">
            <div className="flex-1 flex flex-col justify-center">
              {selectedRec ? (
                <div className="p-8 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 transition-all duration-300 shadow-2xl">
                  <div className="flex justify-between items-start mb-6">
                    <span className="text-pink-300 text-[11px] font-bold uppercase tracking-widest px-3 py-1 bg-pink-500/10 rounded-full border border-pink-500/20">
                      #{selectedRec.rank} Recommended
                    </span>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="text-white/40 hover:text-white/80 text-xs tracking-wider uppercase"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Product Image Box */}
                  <div className="w-full aspect-square bg-black/40 rounded-2xl mb-6 overflow-hidden flex items-center justify-center p-6 border border-white/5 shadow-inner">
                    {selectedRec.cosmeticProduct?.fileUrl?.fileUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedRec.cosmeticProduct.fileUrl.fileUrl}
                        alt={selectedRec.cosmeticProduct?.name || "Product"}
                        className="w-full h-full object-contain drop-shadow-2xl"
                      />
                    ) : (
                      <span className="text-white/20 text-xs uppercase tracking-widest">
                        No Image
                      </span>
                    )}
                  </div>

                  <div className="text-[12px] text-pink-300/80 uppercase tracking-widest mb-2 font-semibold">
                    {selectedRec.cosmeticProduct?.brand || "Curated Brand"}
                  </div>
                  <h2 className="text-3xl font-light leading-tight mb-5 text-white/90">
                    {selectedRec.cosmeticProduct?.name || "Unknown Product"}
                  </h2>

                  <p className="text-[15px] text-white/60 leading-relaxed mb-6 font-light">
                    {selectedRec.reason}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {(selectedRec.cosmeticProduct?.tags ?? []).slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="px-3 py-1.5 bg-white/10 rounded-lg text-[10px] uppercase tracking-widest text-white/70 border border-white/5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ) : skinAnalysisResult ? (
                <div className="p-8 bg-gradient-to-br from-pink-500/10 to-purple-600/10 backdrop-blur-md rounded-3xl border border-pink-500/20 shadow-2xl shadow-pink-500/5 transition-all duration-500">
                  <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mb-6 border border-pink-500/30">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-pink-300"
                    >
                      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  </div>
                  <h2 className="text-4xl font-light mb-2 text-white">
                    Skin Profile
                  </h2>
                  <div className="text-sm text-pink-200/60 uppercase tracking-widest mb-8">
                    Evaluation Details
                  </div>

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
                              className="px-3 py-1.5 bg-red-500/10 text-red-200 border border-red-500/20 rounded-lg text-xs uppercase font-medium tracking-wider"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {skinAnalysisResult.routineTip && (
                      <div className="mt-8 pt-6 border-t border-white/10">
                        <div className="text-xs text-pink-300/80 uppercase tracking-widest mb-3 font-semibold">
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
                <div className="flex flex-col items-center justify-center text-white/30 p-12 text-center border border-white/5 rounded-3xl bg-white/[0.02]">
                  <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white/80 animate-spin mb-6" />
                  <span className="text-sm uppercase tracking-widest font-light">
                    Analyzing Skin...
                  </span>
                </div>
              )}
            </div>

            {/* AI Voice Bubble */}
            {aiSuggestion && (
              <div className="mt-6 p-5 bg-gradient-to-r from-pink-500/10 to-purple-600/10 border border-pink-500/20 rounded-2xl backdrop-blur-md shrink-0 shadow-lg">
                <p className="text-[14px] text-pink-100/90 italic leading-relaxed font-light">
                  &quot;{aiSuggestion}&quot;
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Recommendations 6-10 */}
        <div className="flex flex-col w-[28%] h-full overflow-hidden">
          <CosmeticGrid
            label="Targeted Treatments"
            pagedItems={rightColRecs}
            loading={isLoadingRecommendations}
            pageSize={5}
            columns={1}
            selectedId={selectedRec?.id}
            onSelect={(rec) => setSelectedId(rec.id)}
            emptyMessage="No more products"
          />
        </div>
      </div>
    </div>
  );
}
