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
import { Sparkles } from "lucide-react";
import {
  QuickResponseChips,
  getToday,
  nextWeekday,
} from "@/components/QuickResponseChips";
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

const COSMETIC_QUICK_CHATS = [
  {
    label: "Oily skin",
    prompt: "Show products for oily skin",
    tone: "from-emerald-300/15 to-cyan-300/10",
  },
  {
    label: "Dry skin",
    prompt: "Show products for dry skin",
    tone: "from-amber-200/15 to-pink-200/10",
  },
  {
    label: "Acne-prone",
    prompt: "Show products for acne-prone skin",
    tone: "from-rose-300/15 to-red-300/10",
  },
  {
    label: "Sensitive",
    prompt: "Show products for sensitive skin",
    tone: "from-violet-200/15 to-sky-200/10",
  },
] as const;

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
  const [activeQuickChat, setActiveQuickChat] = useState<string | null>(null);

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

  const runQuickChat = useCallback(
    async (prompt: string) => {
      if (isProcessing || isHandoffLoading) return;

      setActiveQuickChat(prompt);
      setSelectedId(null);
      setIsHandoffLoading(true);
      const mirrorStore = useMirrorStore.getState();
      mirrorStore.setPendingCosmeticsData(null);
      mirrorStore.setChatCosmeticsData(null);
      mirrorStore.clearAiSuggestion();

      try {
        await submitText(prompt);
      } catch (err) {
        console.error("[cosmetics-quick-chat]", err);
      } finally {
        setIsHandoffLoading(false);
      }
    },
    [isHandoffLoading, isProcessing, submitText],
  );

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
  const quickChatBusy = isProcessing || isHandoffLoading;

  // Show the cycling quotes whenever the AI is talking (overrides the product /
  // skin-profile view) or while nothing has loaded yet.
  const showQuotes = isProcessing || (!selectedRec && !skinAnalysisResult);

  return (
    <div
      className="w-full h-full relative overflow-hidden bg-canvas text-white flex flex-col"
      style={{ fontFamily: "sans-serif", touchAction: "none" }}
    >
      <ChatNavLoader spinnerColor="pink" />

      <MirrorHeader
        className="w-full relative z-10"
        style={{ background: "transparent" }}
        onBack={() => router.back()}
      />

      {/* Main 3 Column Layout */}
      <div className="flex-1 min-h-0 flex w-full h-full p-4 gap-6 pt-2">
        {/* Left Column - Recommendations 1-5 */}
        <div className="flex min-h-0 flex-col w-[28%] h-full overflow-hidden">
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
        <div className="flex-1 h-full flex flex-col items-center justify-center p-6 relative">
          <div className="w-full h-full max-w-lg flex flex-col">
            <div className="flex flex-col justify-center">
              {!showQuotes && selectedRec ? (
                <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl transition-all duration-300 bg-gradient-to-b from-[#0b0b1c] via-[#150a26] to-[#1d0e35]">
                  {/* Header — sparkle + RECOMMENDED PRODUCT */}
                  <div className="relative z-10 flex items-center justify-center gap-2 pt-5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-300/80" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-violet-200/70">
                      Recommended Product
                    </span>
                  </div>

                  {/* Product floating over a glowing pedestal */}
                  <div className="relative z-10 flex items-center justify-center px-8 pt-5 pb-4">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 h-36 w-56 rounded-full blur-3xl"
                      style={{
                        background:
                          "radial-gradient(ellipse at center, rgba(139,92,246,0.55), rgba(139,92,246,0.14) 45%, transparent 72%)",
                      }}
                    />
                    <div className="relative flex w-full max-h-[300px] aspect-square items-center justify-center">
                      {selectedRec.cosmeticProduct?.fileUrl?.fileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedRec.cosmeticProduct.fileUrl.fileUrl}
                          alt={selectedRec.cosmeticProduct?.name || "Product"}
                          decoding="async"
                          className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.65)]"
                          style={{ filter: "none", opacity: 1 }}
                        />
                      ) : (
                        <span className="relative z-10 text-white/20 text-xs uppercase tracking-widest">
                          No Image
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="relative z-10 px-7 pb-7 text-center">
                    <div className="text-[12px] text-violet-200/70 uppercase tracking-widest mb-1.5 font-semibold">
                      {selectedRec.cosmeticProduct?.brand || "Curated Brand"}
                    </div>
                    <h2 className="text-2xl font-light leading-tight mb-3 text-white/90">
                      {selectedRec.cosmeticProduct?.name || "Unknown Product"}
                    </h2>
                    <p className="text-[14px] text-white/55 leading-relaxed mb-5 font-light">
                      {selectedRec.reason}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {(selectedRec.cosmeticProduct?.tags ?? [])
                        .slice(0, 4)
                        .map((t) => (
                          <span
                            key={t}
                            className="px-3 py-1.5 bg-white/10 rounded-lg text-[10px] uppercase tracking-widest text-white/70 border border-white/5"
                          >
                            {t}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ) : !showQuotes && skinAnalysisResult ? (
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
                <QuoteCarousel
                  quotes={COSMETIC_QUOTES}
                  label="Skin Tip"
                  labelClassName="text-pink-300/40"
                  className="flex flex-col items-center justify-center p-12 text-center border border-white/5 rounded-3xl bg-white/[0.02]"
                />
              )}
              <QuickResponseChips
                className="mt-3"
                prompts={[
                  `Recommend a morning skincare routine for today, ${getToday()}, based on my skin analysis.`,
                  `I have an important event on ${nextWeekday(1)} — what products should I use for a fresh, polished look?`,
                  "What are the top products I should use right now to address my main skin concerns?",
                  "Suggest a calming evening routine I can follow tonight to repair and hydrate my skin.",
                  "I want to visibly improve my skin's texture and glow over the next 30 days — build me a product plan.",
                ]}
              />
            </div>

            {/* AI Voice Bubble */}
            <div className="mt-5 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] uppercase tracking-[0.32em] text-pink-200/65">
                  Skin focus
                </span>
                <span className="text-[11px] text-white/45">Tap a concern</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {COSMETIC_QUICK_CHATS.map((item) => {
                  const active =
                    activeQuickChat === item.prompt && quickChatBusy;
                  return (
                    <button
                      key={item.prompt}
                      type="button"
                      disabled={quickChatBusy}
                      onClick={() => void runQuickChat(item.prompt)}
                      className={`group min-h-[44px] rounded-lg border px-3 text-left transition-all duration-200 ${
                        active
                          ? "border-pink-300/50 bg-pink-300/15 text-white"
                          : "border-white/10 bg-white/[0.035] text-white/70 hover:border-pink-200/35 hover:bg-white/[0.07]"
                      } disabled:cursor-wait disabled:opacity-70`}
                    >
                      <span
                        className={`block h-1 w-9 rounded-full bg-gradient-to-r ${item.tone} mb-2 opacity-90`}
                      />
                      <span className="block text-[12px] font-medium leading-none">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-[11px] uppercase tracking-[0.22em] text-white/50 group-hover:text-pink-100/65">
                        Products
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

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
        <div className="flex min-h-0 flex-col w-[28%] h-full overflow-hidden">
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
    </div>
  );
}
