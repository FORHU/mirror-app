"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { AlertCircle, Sparkles, WandSparkles } from "lucide-react";
import { motion } from "motion/react";
import { useOverviewStore } from "../store/useOverviewStore";
import type { CosmeticTileItem, OutfitTileItem, TileState } from "../types";

const proxied = (url: string) =>
  `/api/proxy-image?url=${encodeURIComponent(url)}`;

function OutfitListPane({
  outfits,
  selectedId,
  onSelect,
}: {
  outfits: OutfitTileItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!outfits.length) return <EmptyTile text="No outfits yet." />;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto scrollbar-hidden pb-20 pr-1 relative z-10">
      {outfits.map((outfit) => (
        <button
          key={outfit.id}
          onClick={() => onSelect(outfit.id)}
          className={`shrink-0 rounded-2xl overflow-hidden border transition-all text-left group/outfit ${
            outfit.id === selectedId
              ? "border-white/40 ring-1 ring-white/20 opacity-100"
              : "border-white/10 opacity-60 hover:opacity-100 hover:border-white/25"
          }`}
        >
          <div className="relative w-full" style={{ aspectRatio: "3/4" }}>
            {outfit.imageUrl ? (
              <img
                src={proxied(outfit.imageUrl)}
                alt={outfit.name}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover/outfit:scale-[1.03]"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = "0.15";
                }}
              />
            ) : (
              <div className="w-full h-full bg-white/5 flex items-center justify-center">
                <span className="text-white/20 text-xs">No Image</span>
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white text-[11px] font-semibold truncate leading-snug drop-shadow-md">
                {outfit.name}
              </p>
              {outfit.vibe && (
                <p className="text-white/60 text-[9px] uppercase tracking-widest truncate mt-0.5 font-medium">
                  {outfit.vibe}
                </p>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function OutfitDetailPane({ outfit }: { outfit: OutfitTileItem | null }) {
  if (!outfit) return null;

  return (
    <motion.div
      key={outfit.id}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col w-full h-full px-4 pt-2 pb-20 gap-4"
    >
      {/* Outfit hero image */}
      <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-white/5">
        {outfit.imageUrl ? (
          <img
            src={proxied(outfit.imageUrl)}
            alt={outfit.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/20 text-xs uppercase tracking-widest">
              No Image
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-white font-bold text-xl leading-snug drop-shadow-md">
            {outfit.name}
          </p>
          {outfit.vibe && (
            <p className="text-white/60 text-[10px] font-semibold tracking-widest mt-1 truncate uppercase">
              {outfit.vibe}
            </p>
          )}
        </div>
      </div>

      {/* Garments strip */}
      {outfit.garments.length > 0 && (
        <div className="flex gap-3 overflow-x-auto scrollbar-hidden shrink-0 pb-1">
          {outfit.garments.map((g) => (
            <div
              key={g.id}
              title={g.name}
              className="shrink-0 flex flex-col gap-1"
              style={{ width: "72px" }}
            >
              <div
                className="rounded-xl overflow-hidden bg-white/5 border border-white/10"
                style={{ aspectRatio: "3/4" }}
              >
                <img
                  src={proxied(g.imageUrl)}
                  alt={g.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity =
                      "0.15";
                  }}
                />
              </div>
              <p className="text-white/60 text-[9px] truncate text-center px-0.5 font-medium">
                {g.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {outfit.reason && (
        <p className="text-white/50 text-xs line-clamp-2 shrink-0 font-light leading-relaxed">
          {outfit.reason}
        </p>
      )}
    </motion.div>
  );
}

function TileHeader({
  icon: Icon,
  label,
  rightContent,
}: {
  icon: React.ElementType;
  label: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pb-3 relative z-10 w-full">
      <div className="flex items-center gap-3 shrink-0">
        <div className="icon-box !w-10 !h-10 flex items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 group-hover:bg-white/10">
          <Icon className="w-5 h-5 text-white/90" strokeWidth={1.5} />
        </div>
        <span className="text-white/60 text-[11px] font-bold uppercase tracking-[0.2em]">
          {label}
        </span>
      </div>
      {rightContent}
    </div>
  );
}

function TileSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 flex-1 opacity-80">
      <div
        className="w-full rounded-2xl bg-white/[0.04] shimmer-bg"
        style={{ aspectRatio: "3/2" }}
      />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-full bg-white/[0.04] shimmer-bg"
          style={{ width: `${85 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

function TileError({ text }: { text: string }) {
  return (
    <div className="h-full min-h-[120px] flex flex-col items-center justify-center gap-2 text-center">
      <AlertCircle className="w-6 h-6 text-white/40" />
      <p className="text-white/50 text-sm max-w-[80%] font-medium">{text}</p>
    </div>
  );
}

function EmptyTile({ text }: { text: string }) {
  return (
    <div className="h-full min-h-[120px] flex items-center justify-center text-center">
      <p className="text-white/40 text-sm max-w-[220px] leading-relaxed font-medium">
        {text}
      </p>
    </div>
  );
}

function CosmeticsStrip({
  items,
  standalone,
  selectedId,
  onSelect,
}: {
  items: CosmeticTileItem[];
  standalone?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <div
      className={`relative z-10 ${standalone ? "flex flex-col gap-3 h-full overflow-y-auto scrollbar-hidden pr-1" : "grid gap-5 grid-cols-3 overflow-hidden"}`}
    >
      {items.slice(0, standalone ? 20 : 6).map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect?.(c.id)}
          className={`min-w-0 transition-all group/item text-left overflow-hidden ${
            standalone
              ? `flex flex-col h-[calc((100%-3rem)/5)] shrink-0 rounded-2xl overflow-hidden ${selectedId === c.id ? "ring-1 ring-white/30 bg-white/5" : "opacity-60 hover:opacity-100"}`
              : "flex flex-col rounded-2xl bg-white/5 border border-white/10 hover:border-white/30"
          }`}
        >
          {standalone ? (
            <>
              <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
                <img
                  src={proxied(c.imageUrl)}
                  alt={c.name}
                  loading="lazy"
                  className="w-full h-full object-contain transition-transform duration-500 group-hover/item:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity =
                      "0.15";
                  }}
                />
              </div>
              <div className="shrink-0 px-2 py-1.5 bg-black/30">
                <p className="text-white/90 text-[10px] font-bold line-clamp-1 drop-shadow-sm leading-snug">
                  {c.name}
                </p>
                {c.brand && (
                  <p className="text-white/50 text-[8px] mt-0.5 font-semibold uppercase tracking-widest truncate">
                    {c.brand}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="aspect-square bg-white/3 overflow-hidden">
                <img
                  src={proxied(c.imageUrl)}
                  alt={c.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-110"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity =
                      "0.15";
                  }}
                />
              </div>
              <div className="px-3 py-2.5 shrink-0 bg-black/20">
                <p className="text-white/90 text-[13px] font-bold truncate drop-shadow-sm">
                  {c.name}
                </p>
                {c.brand && (
                  <p className="text-white/50 text-[10px] mt-0.5 font-semibold uppercase tracking-widest truncate">
                    {c.brand}
                  </p>
                )}
              </div>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

function Tile({
  icon,
  label,
  state,
  children,
  className,
  delay = 0,
  rightContent,
  standalone = false,
}: {
  icon: React.ElementType;
  label: string;
  state: TileState<unknown>;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  rightContent?: React.ReactNode;
  standalone?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={[
        standalone
          ? "flex flex-col p-2 min-h-0 overflow-hidden relative group"
          : "glass-card-strong neon-border-white rounded-4xl flex flex-col p-6 min-h-0 overflow-hidden relative group",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!standalone && (
        <>
          {/* Premium Glass Glare Overlay */}
          <div className="absolute inset-0 bg-linear-to-br from-white/8 via-white/1 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        </>
      )}

      <TileHeader icon={icon} label={label} rightContent={rightContent} />
      <div className="flex-1 min-h-0 flex flex-col relative z-10">
        {state.status === "loading" ? (
          <TileSkeleton />
        ) : state.status === "error" ? (
          <TileError text={state.error ?? "Something went wrong"} />
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}

export function OverviewGrid() {
  const outfits = useOverviewStore((s) => s.outfits);
  const cosmetics = useOverviewStore((s) => s.cosmetics);
  const skinAnalysis = useOverviewStore((s) => s.skinAnalysis);

  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);

  const outfitList = outfits.data ?? [];
  const selectedOutfit =
    outfitList.find((o) => o.id === selectedOutfitId) ?? outfitList[0] ?? null;

  const outfitsState: TileState<boolean> = {
    status: outfits.status,
    data: outfitList.length ? true : null,
    error: outfits.error,
  };

  // Empty state — nothing loading and nothing to show
  if (outfits.status === "idle" && cosmetics.status === "idle") {
    return (
      <div className="flex-1 flex items-center justify-center w-full">
        <p className="text-white/40 text-sm text-center max-w-xs leading-relaxed font-light">
          Tap a scenario in AI Assistant to get your personalised look.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full">
      {/* Left 25% — Outfit list */}
      <Tile
        icon={WandSparkles}
        label="Outfits"
        state={outfitsState}
        className="w-[25%] h-full shrink-0"
        delay={0.1}
        standalone
      >
        <OutfitListPane
          outfits={outfitList}
          selectedId={selectedOutfit?.id ?? null}
          onSelect={setSelectedOutfitId}
        />
      </Tile>

      {/* Center 50% — Selected outfit image + garments */}
      <div className="w-[50%] flex flex-col">
        <OutfitDetailPane outfit={selectedOutfit} />
      </div>

      {/* Right 25% — Skin Routine */}
      <Tile
        icon={Sparkles}
        label="Skin Routine"
        state={cosmetics}
        className="w-[25%] h-full shrink-0"
        delay={0.2}
        standalone
        rightContent={
          skinAnalysis.data?.skinType && (
            <div className="px-2.5 py-1 rounded-lg bg-white/10 text-white/90 text-[10px] font-bold uppercase tracking-wider border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)]">
              {skinAnalysis.data.skinType}
            </div>
          )
        }
      >
        {cosmetics.data?.length ? (
          <CosmeticsStrip items={cosmetics.data} standalone />
        ) : (
          <EmptyTile text="No cosmetic picks yet." />
        )}
      </Tile>
    </div>
  );
}
