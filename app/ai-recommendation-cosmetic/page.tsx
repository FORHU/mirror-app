"use client";

import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/navigation";
import { useVoice } from "@/modules/shared/voice/useVoice";
import { useEffect, useMemo, useState } from "react";
import { CosmeticGrid } from "@/modules/cosmetics/components/CosmeticGrid";
import type { SkinRecommendation } from "@/modules/shared/api/cosmetics.service";

export default function CosmeticRecommendationPage() {
  const router = useRouter();
  const skinAnalysisResult = useMirrorStore((s) => s.skinAnalysisResult);
  const pendingCosmeticsData = useMirrorStore((s) => s.pendingCosmeticsData);
  const aiSuggestion = useMirrorStore((s) => s.aiSuggestion);
  const chatNavPending = useMirrorStore((s) => s.chatNavPending);
  const chatStreamingText = useMirrorStore((s) => s.chatStreamingText);
  const chatCosmeticsData = useMirrorStore((s) => s.chatCosmeticsData);

  const pageContext = useMemo(
    () => ({
      route: ROUTES.AI_RECOMMENDATION_COSMETIC,
      pageName: "Cosmetic Recommendations",
      activeStep: "reviewing_products",
      mode: "cosmetics" as const,
    }),
    [],
  );

  useVoice(pageContext);

  // Consume cosmetics data from the chat-path nav_early flow (ChatWonderProvider).
  useEffect(() => {
    if (!chatCosmeticsData) return;
    useMirrorStore.getState().setChatCosmeticsData(null);
    useMirrorStore.getState().setPendingCosmeticsData(chatCosmeticsData);
  }, [chatCosmeticsData]);

  // Pagination state for recommendations
  const [recPage, setRecPage] = useState(0);
  const PAGE_SIZE = 10;

  // Determine which recommendations to show
  const allRecs = useMemo(() => {
    if (pendingCosmeticsData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = pendingCosmeticsData as any;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.recommendations))
        return data.recommendations;
      if (Array.isArray(data.sets))
        return data.sets.flatMap(
          (s: { recommendations?: SkinRecommendation[] }) =>
            s.recommendations || [],
        );
    }
    return skinAnalysisResult?.recommendations || [];
  }, [pendingCosmeticsData, skinAnalysisResult]);

  // Sort recommendations by rank
  const sortedRecs = useMemo(() => {
    return [...allRecs].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  }, [allRecs]);

  const totalPages = Math.ceil(sortedRecs.length / PAGE_SIZE);
  const pagedRecs = sortedRecs.slice(
    recPage * PAGE_SIZE,
    (recPage + 1) * PAGE_SIZE,
  );

  const [selectedRec, setSelectedRec] = useState<SkinRecommendation | null>(
    null,
  );

  return (
    <div
      className="w-full h-full relative overflow-hidden bg-black text-white flex"
      style={{ fontFamily: "sans-serif", touchAction: "none" }}
    >
      {chatNavPending && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-full border-2 border-pink-500/20 border-t-pink-400/80 animate-spin mb-6" />
          {chatStreamingText && (
            <p className="text-white/70 text-base font-light text-center max-w-sm leading-relaxed px-8">
              {chatStreamingText}
            </p>
          )}
        </div>
      )}

      {/* Left panel — 50% Transparent for Mirror Reflection */}
      <div
        className="h-full relative overflow-hidden"
        style={{ flex: "0 0 50%", width: "50%" }}
      >
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={() => router.back()}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-[10px] uppercase tracking-wider rounded backdrop-blur-sm transition-colors border border-white/20"
          >
            Back
          </button>
        </div>
      </div>

      {/* Middle panel — 25% (Skin Profile or Selected Product) */}
      <div
        className="h-full relative flex flex-col items-center justify-center p-6 bg-black"
        style={{
          flex: "0 0 25%",
          width: "25%",
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 flex flex-col justify-center">
            {selectedRec ? (
              <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 transition-all duration-300">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-pink-300 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-pink-500/10 rounded-full border border-pink-500/20">
                    #{selectedRec.rank} Recommended
                  </span>
                  <button
                    onClick={() => setSelectedRec(null)}
                    className="text-white/40 hover:text-white/80 text-xs"
                  >
                    Clear
                  </button>
                </div>

                {/* Product Image Box */}
                <div className="w-full aspect-square bg-black/40 rounded-xl mb-4 overflow-hidden flex items-center justify-center p-4 border border-white/5">
                  {selectedRec.cosmeticProduct.fileUrl?.fileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedRec.cosmeticProduct.fileUrl.fileUrl}
                      alt={selectedRec.cosmeticProduct.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-white/20 text-xs uppercase">
                      No Image
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-pink-300/80 uppercase tracking-widest mb-1 font-medium">
                  {selectedRec.cosmeticProduct.brand || "Curated Brand"}
                </div>
                <h2 className="text-xl font-medium leading-tight mb-3">
                  {selectedRec.cosmeticProduct.name}
                </h2>

                <p className="text-[13px] text-white/70 leading-relaxed mb-4">
                  {selectedRec.reason}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {selectedRec.cosmeticProduct.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-1 bg-white/10 rounded-md text-[9px] uppercase tracking-wider text-white/80"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : skinAnalysisResult ? (
              <div className="p-6 bg-gradient-to-br from-pink-500/10 to-purple-600/10 backdrop-blur-md rounded-3xl border border-pink-500/20 shadow-2xl shadow-pink-500/5">
                <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center mb-4 border border-pink-500/30">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-pink-300"
                  >
                    <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </div>
                <h2 className="text-2xl font-light mb-1 text-white">
                  Skin Profile
                </h2>
                <div className="text-xs text-pink-200/60 uppercase tracking-widest mb-6">
                  Evaluation Details
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                      Detected Type
                    </div>
                    <div className="text-lg font-medium text-white/90 capitalize">
                      {skinAnalysisResult.skinType} Skin
                    </div>
                  </div>

                  {skinAnalysisResult.concerns.length > 0 && (
                    <div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                        Key Concerns
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {skinAnalysisResult.concerns.map((c) => (
                          <span
                            key={c}
                            className="px-2.5 py-1 bg-red-500/10 text-red-200 border border-red-500/20 rounded-md text-[10px] uppercase font-medium"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {skinAnalysisResult.routineTip && (
                    <div className="mt-6 pt-4 border-t border-white/10">
                      <div className="text-[10px] text-pink-300/80 uppercase tracking-wider mb-2 font-medium">
                        AI Routine Tip
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed italic">
                        &quot;{skinAnalysisResult.routineTip}&quot;
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-white/30 p-8 text-center border border-white/5 rounded-3xl bg-white/[0.02]">
                <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin mb-4" />
                <span className="text-xs uppercase tracking-widest">
                  Analyzing Skin...
                </span>
              </div>
            )}
          </div>

          {/* AI Voice Bubble */}
          {aiSuggestion && (
            <div className="mt-4 p-4 bg-gradient-to-r from-pink-500/10 to-purple-600/10 border border-pink-500/20 rounded-2xl backdrop-blur-md shrink-0">
              <p className="text-[13px] text-pink-100/90 italic leading-relaxed">
                &quot;{aiSuggestion}&quot;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — 25% Cosmetics Grid (10 items: 5 rows x 2 cols) */}
      <div
        className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden bg-black relative"
        style={{ flex: "0 0 25%", width: "25%" }}
      >
        <div className="flex-1 overflow-hidden pt-2">
          <CosmeticGrid
            label="Curated Cosmetics"
            pagedItems={pagedRecs}
            loading={!skinAnalysisResult && !pendingCosmeticsData}
            pageSize={PAGE_SIZE}
            currentPage={recPage}
            totalPages={totalPages}
            onNext={() => setRecPage((p) => Math.min(totalPages - 1, p + 1))}
            onPrev={() => setRecPage((p) => Math.max(0, p - 1))}
            onPageChange={setRecPage}
            columns={2}
            selectedId={selectedRec?.id}
            onSelect={setSelectedRec}
            emptyMessage="No products recommended."
          />
        </div>
      </div>
    </div>
  );
}
