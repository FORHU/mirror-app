"use client";

import { useVoiceContext } from "./VoiceProvider";

interface AiEvent {
  type?: string;
  timeBlock?: string;
  fashion?: {
    suggestion?: string;
    tags?: string[];
  };
  cosmetics?: {
    resolvedProducts?: Array<{
      id: string;
      name: string;
      imageUrl: string;
      brand: string;
      reason: string;
    }>;
  };
}

export function AiEventsOverlay() {
  const { isSpeaking, aiEvents } = useVoiceContext();

  // Only show the overlay if the AI is actively speaking and provided event data
  if (!isSpeaking || !aiEvents || aiEvents.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-md transition-opacity duration-500 animate-in fade-in zoom-in-95">
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto max-h-full p-4 pointer-events-auto">
        {(aiEvents as AiEvent[]).map((event, idx) => (
          <div
            key={idx}
            className="bg-white/10 border border-white/20 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col"
          >
            {/* Header: Event Type & Time */}
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h3 className="text-2xl font-light text-white tracking-wide capitalize">
                {event.type}
              </h3>
              <span className="text-xs px-3 py-1 bg-white/20 text-white rounded-full uppercase tracking-widest font-semibold">
                {event.timeBlock}
              </span>
            </div>

            {/* Outfit Suggestion */}
            {event.fashion?.suggestion && (
              <div className="mb-6">
                <h4 className="text-white/50 text-xs uppercase tracking-[0.2em] mb-2 font-bold">
                  Recommended Outfit
                </h4>
                <p className="text-white/90 text-md leading-relaxed font-light">
                  {event.fashion.suggestion}
                </p>
                {(event.fashion.tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {event.fashion.tags!.map((tag: string) => (
                      <span
                        key={tag}
                        className="text-[10px] uppercase tracking-wider bg-white/10 text-white/70 px-2 py-1 rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cosmetics Recommendations */}
            {(event.cosmetics?.resolvedProducts?.length ?? 0) > 0 && (
              <div className="mt-auto">
                <h4 className="text-white/50 text-xs uppercase tracking-[0.2em] mb-3 font-bold">
                  Curated Cosmetics
                </h4>
                <div className="space-y-3">
                  {event.cosmetics!.resolvedProducts!.map(
                    (prod: {
                      id: string;
                      name: string;
                      imageUrl: string;
                      brand: string;
                      reason: string;
                    }) => (
                      <div
                        key={prod.id}
                        className="flex items-center gap-4 bg-black/30 rounded-2xl p-3 border border-white/5 hover:bg-black/40 transition-colors"
                      >
                        {prod.imageUrl ? (
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 shrink-0 relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                            <span className="text-white/30 text-xs">N/A</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm leading-tight truncate">
                            {prod.name}
                          </div>
                          {prod.brand && (
                            <div className="text-white/50 text-xs truncate mt-0.5">
                              {prod.brand}
                            </div>
                          )}
                          {prod.reason && (
                            <div className="text-white/40 text-[10px] mt-1 line-clamp-2 leading-tight italic">
                              {prod.reason}
                            </div>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
