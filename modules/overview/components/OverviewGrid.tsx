"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { AlertCircle, Sparkles, WandSparkles } from "lucide-react";
import { motion } from "motion/react";
import type {
  CosmeticTileItem,
  GarmentTileItem,
  OutfitTileItem,
  SkinAnalysisTileItem,
  TileState,
} from "../types";

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
    <div className="flex flex-col h-full relative z-10">
      {outfits.map((outfit) => (
        <button
          key={outfit.id}
          onTouchEnd={(e) => {
            e.preventDefault();
            onSelect(outfit.id);
          }}
          onClick={() => onSelect(outfit.id)}
          className={`flex-1 min-h-0 mb-3 last:mb-0 rounded-2xl overflow-hidden transition-all text-left group/outfit relative ${
            outfit.id === selectedId
              ? "ring-1 ring-white/30 opacity-100"
              : "opacity-60 hover:opacity-100"
          }`}
        >
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
          <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </button>
      ))}
    </div>
  );
}

function CosmeticDetailPane({
  item,
  onExpand,
}: {
  item: CosmeticTileItem | null;
  onExpand: () => void;
}) {
  if (!item) return null;
  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center w-full h-full overflow-hidden"
    >
      {/* Hero image */}
      <div className="relative shrink min-h-0 overflow-hidden group/hero flex items-center justify-center max-h-[50%] w-full px-12 py-4">
        <motion.img
          key={item.imageUrl}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          src={proxied(item.imageUrl)}
          alt={item.name}
          className="w-full h-full object-contain cursor-zoom-in"
          onClick={onExpand}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = "0.15";
          }}
        />
        <button
          onClick={onExpand}
          className="absolute top-0 right-4 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 text-white/90 active:bg-black/60 transition-all duration-200 shadow-lg backdrop-blur-md"
          style={{ touchAction: "manipulation" }}
          title="Full Screen"
        >
          <svg
            width="20"
            height="20"
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
      </div>

      {/* Details and Ingredients */}
      <div className="shrink-0 max-h-[45%] w-full overflow-y-auto scrollbar-hidden flex flex-col items-center gap-3 px-12 pt-4 pb-6 text-center">
        <div className="flex flex-col items-center">
          <p className="text-white font-bold text-xl leading-snug drop-shadow-lg text-center">
            {item.name}
          </p>
          {item.brand && (
            <p className="text-white/60 text-[10px] font-semibold tracking-widest mt-1 truncate uppercase text-center">
              {item.brand}
            </p>
          )}
        </div>

        {(item.category ||
          item.type ||
          item.tags?.length ||
          item.benefits?.length) && (
          <div className="flex gap-1.5 flex-wrap justify-center">
            {item.category && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[9px] font-semibold uppercase tracking-wider">
                {item.category.replace(/_/g, " ")}
              </span>
            )}
            {item.type && item.type !== item.category && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[9px] font-semibold uppercase tracking-wider">
                {item.type.replace(/_/g, " ")}
              </span>
            )}
            {item.tags?.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-white/50 text-[9px] font-medium"
              >
                {t}
              </span>
            ))}
            {item.benefits?.map((b) => (
              <span
                key={b}
                className="px-2 py-0.5 rounded-full bg-[#4fc3f7]/10 border border-[#4fc3f7]/20 text-[#4fc3f7] text-[9px] font-medium"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        {(item.reason || item.details) && (
          <p className="text-white/60 text-xs font-light leading-relaxed text-center">
            {item.reason || item.details}
          </p>
        )}

        {/* Ingredients from metaData */}
        {(() => {
          const raw = item.metaData?.ingredients;
          const list = Array.isArray(raw)
            ? raw
            : Array.isArray((raw as Record<string, unknown>)?.ingredients)
              ? ((raw as Record<string, unknown>).ingredients as unknown[])
              : null;
          if (!list?.length) return null;
          const ingredients = list
            .map((v) =>
              typeof v === "string"
                ? v
                : v && typeof v === "object"
                  ? String(
                      (v as Record<string, unknown>).name ??
                        (v as Record<string, unknown>).value ??
                        JSON.stringify(v),
                    )
                  : String(v),
            )
            .filter(Boolean);
          if (!ingredients.length) return null;
          return (
            <div className="flex flex-col items-center">
              <p className="text-white/40 text-[9px] uppercase tracking-widest mb-1.5 font-semibold text-center">
                Ingredients
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {ingredients.map((ing, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-white/50 text-[9px] font-medium"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </motion.div>
  );
}

function OutfitDetailPane({
  outfit,
  selectedGarmentId,
  onSelectGarment,
  onExpand,
}: {
  outfit: OutfitTileItem | null;
  selectedGarmentId: string | null;
  onSelectGarment: (id: string | null) => void;
  onExpand: () => void;
}) {
  if (!outfit) return null;

  const activeGarment =
    outfit.garments.find((g) => g.id === selectedGarmentId) ?? null;
  const heroUrl = activeGarment?.imageUrl || outfit.imageUrl;
  const heroName = activeGarment?.name || outfit.name;

  return (
    <motion.div
      key={outfit.id}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center w-full h-full overflow-hidden"
    >
      {/* Hero image */}
      <div className="relative flex-1 min-h-0 overflow-hidden group/hero w-full px-4 flex items-center justify-center pb-2">
        <div className="w-full h-full flex items-center justify-center relative">
          {heroUrl ? (
            <>
              <motion.img
                key={heroUrl}
                src={proxied(heroUrl)}
                alt={heroName}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full object-contain cursor-zoom-in"
                onClick={onExpand}
              />
              <button
                onClick={onExpand}
                className="absolute top-4 right-0 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 text-white/90 active:bg-black/60 transition-all duration-200 shadow-lg backdrop-blur-md"
                style={{ touchAction: "manipulation" }}
                title="Full Screen"
              >
                <svg
                  width="20"
                  height="20"
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
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white/20 text-xs uppercase tracking-widest">
                No Image
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Garment strip + detail — capped so they never push past screen */}
      {/* Details section — capped so they never push past screen */}
      <div className="shrink-0 max-h-[50%] w-full overflow-y-auto scrollbar-hidden flex flex-col items-start px-8 pt-4 pb-6 text-left border-t border-white/5">
        {/* Outfit Title & Description */}
        <div className="flex flex-col w-full mb-4">
          <p className="text-white font-bold text-base leading-snug">
            {outfit.name}
          </p>
          {outfit.reason && (
            <p className="text-white/60 text-[11px] font-light leading-relaxed mt-2">
              {outfit.reason}
            </p>
          )}
        </div>

        {/* Vertical Detailed Garments List */}
        {outfit.garments.length > 0 && (
          <div className="flex flex-col w-full">
            {outfit.garments.map((g) => {
              const isSelected = g.id === selectedGarmentId;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelectGarment(isSelected ? null : g.id)}
                  className="flex gap-4 w-full text-left transition-all py-3 border-b border-white/5 last:border-0 hover:bg-white/5"
                >
                  <div
                    className={`shrink-0 rounded-[6px] overflow-hidden bg-black/20 ${isSelected ? "ring-1 ring-white/60" : ""}`}
                    style={{ width: "54px", aspectRatio: "4/5" }}
                  >
                    {g.imageUrl ? (
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
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-1 text-center">
                        <span className="text-white/20 text-[8px] uppercase tracking-widest leading-tight">
                          No Image
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0 justify-center">
                    {g.layerLevel && (
                      <p className="text-[#e0e0e0] text-[8px] font-bold uppercase tracking-widest mb-1">
                        {g.layerLevel}
                      </p>
                    )}
                    <p className="text-white text-[12px] font-bold leading-tight mb-1 truncate">
                      {g.name}
                    </p>
                    {g.description && (
                      <p className="text-white/60 text-[10px] leading-relaxed line-clamp-3">
                        {g.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
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
    <div className="flex flex-col pb-3 relative z-10 w-full gap-2">
      <div className="flex items-center gap-3 shrink-0">
        <div className="icon-box !w-10 !h-10 flex items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 group-hover:bg-white/10">
          <Icon className="w-5 h-5 text-white/90" strokeWidth={1.5} />
        </div>
        <span className="text-white/60 text-[11px] font-bold uppercase tracking-[0.2em]">
          {label}
        </span>
      </div>
      {rightContent && <div className="self-start">{rightContent}</div>}
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
      className={`relative z-10 ${standalone ? "flex flex-col h-full px-1" : "grid gap-5 grid-cols-3 overflow-hidden"}`}
    >
      {items.slice(0, standalone ? 4 : 6).map((c) => (
        <button
          key={c.id}
          onTouchEnd={(e) => {
            e.preventDefault();
            onSelect?.(c.id);
          }}
          onClick={() => onSelect?.(c.id)}
          className={`min-w-0 transition-all group/item text-left overflow-hidden ${
            standalone
              ? `flex flex-col flex-1 min-h-0 mb-3 last:mb-0 rounded-[10px] overflow-hidden ${selectedId === c.id ? "border border-white/60" : "border border-transparent opacity-60 hover:opacity-100"}`
              : "flex flex-col rounded-[10px] border border-transparent hover:border-white/30"
          }`}
        >
          {standalone ? (
            <>
              <div className="flex-1 min-h-0 overflow-hidden">
                <img
                  src={proxied(c.imageUrl)}
                  alt={c.name}
                  loading="lazy"
                  className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover/item:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity =
                      "0.15";
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="aspect-square overflow-hidden">
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
          : "rounded-4xl flex flex-col p-6 min-h-0 overflow-hidden relative group",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
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

export function OverviewGrid({
  outfits,
  cosmetics,
  skinAnalysis,
}: {
  outfits: TileState<
    | { outfits: OutfitTileItem[]; garments: GarmentTileItem[] }
    | OutfitTileItem[]
  >;
  cosmetics: TileState<CosmeticTileItem[]>;
  skinAnalysis: TileState<SkinAnalysisTileItem>;
}) {
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [selectedCosmeticId, setSelectedCosmeticId] = useState<string | null>(
    null,
  );
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(
    null,
  );
  const [centerPanel, setCenterPanel] = useState<"outfit" | "cosmetic">(
    "outfit",
  );
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);

  const outfitList = Array.isArray(outfits.data)
    ? outfits.data
    : outfits.data &&
        "outfits" in outfits.data &&
        Array.isArray(outfits.data.outfits)
      ? outfits.data.outfits
      : [];
  const selectedOutfit =
    outfitList.find((o: OutfitTileItem) => o.id === selectedOutfitId) ?? null;

  const activeCosmetic =
    cosmetics.data?.find((c) => c.id === selectedCosmeticId) ?? null;

  const activeGarment =
    selectedOutfit?.garments.find((g) => g.id === selectedGarmentId) ?? null;

  const fullViewImageUrl =
    centerPanel === "cosmetic"
      ? activeCosmetic?.imageUrl
      : activeGarment?.imageUrl || selectedOutfit?.imageUrl;

  const fullViewImageName =
    centerPanel === "cosmetic"
      ? activeCosmetic?.name
      : activeGarment?.name || selectedOutfit?.name;

  const outfitsState: TileState<boolean> = {
    status: outfits.status,
    data: outfitList.length ? true : null,
    error: outfits.error,
  };

  // Empty state — nothing loading and nothing to show
  if (outfits.status === "idle" && cosmetics.status === "idle") {
    return (
      <div className="flex-1 relative w-full overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        >
          <source
            src="https://d1bdogktone6hj.cloudfront.net/uploads/loading.mp4"
            type="video/mp4"
          />
          <source
            src="https://videos.pexels.com/video-files/3129671/3129671-uhd_3840_2160_30fps.mp4"
            type="video/mp4"
          />
        </video>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 min-h-0">
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
          selectedId={
            centerPanel === "outfit" ? (selectedOutfit?.id ?? null) : null
          }
          onSelect={(id) => {
            setSelectedOutfitId(id);
            setSelectedCosmeticId(null);
            setSelectedGarmentId(null);
            setCenterPanel("outfit");
          }}
        />
      </Tile>

      {/* Center 50% — Selected outfit or cosmetic detail */}
      <div className="w-[50%] h-full flex flex-col bg-canvas overflow-hidden">
        {centerPanel === "cosmetic" && selectedCosmeticId ? (
          <CosmeticDetailPane
            item={activeCosmetic}
            onExpand={() => setIsFullViewOpen(true)}
          />
        ) : selectedOutfit ? (
          <OutfitDetailPane
            outfit={selectedOutfit}
            selectedGarmentId={selectedGarmentId}
            onSelectGarment={setSelectedGarmentId}
            onExpand={() => setIsFullViewOpen(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white/30 text-xs tracking-widest uppercase font-semibold">
              Select an item to view details
            </p>
          </div>
        )}
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
          <CosmeticsStrip
            items={cosmetics.data}
            standalone
            selectedId={selectedCosmeticId}
            onSelect={(id) => {
              setSelectedCosmeticId(id);
              setSelectedOutfitId(null);
              setCenterPanel("cosmetic");
            }}
          />
        ) : (
          <EmptyTile text="No cosmetic picks yet." />
        )}
      </Tile>

      {/* Full View Modal */}
      {isFullViewOpen && fullViewImageUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md cursor-zoom-out transition-all duration-300"
          onClick={() => setIsFullViewOpen(false)}
        >
          <img
            src={proxied(fullViewImageUrl)}
            alt={fullViewImageName || "Outfit"}
            style={{
              maxWidth: "92vw",
              maxHeight: "92vh",
              objectFit: "contain",
              borderRadius: "16px",
              boxShadow: "0 0 60px rgba(0,0,0,0.5)",
            }}
          />
          <button
            className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white/80 active:bg-white/30 transition-colors text-xl font-light"
            style={{ touchAction: "manipulation" }}
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
