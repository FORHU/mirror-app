"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { AlertCircle, ShoppingBag, Sparkles, WandSparkles } from "lucide-react";
import { motion } from "motion/react";
import { useOverviewStore } from "../store/useOverviewStore";
import type {
  CosmeticTileItem,
  GarmentTileItem,
  OutfitTileItem,
  TileState,
} from "../types";

const proxied = (url: string) =>
  `/api/proxy-image?url=${encodeURIComponent(url)}`;

function StandaloneDetailsPane({
  item,
}: {
  item: GarmentTileItem | CosmeticTileItem | null;
}) {
  if (!item) return null;

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center gap-10 px-6 py-8 transition-all duration-300 w-full h-full justify-center"
    >
      <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
        {item.imageUrl ? (
          <img
            src={proxied(item.imageUrl)}
            alt={item.name}
            className="w-full h-full object-contain drop-shadow-[0_40px_60px_rgba(0,0,0,0.4)] relative z-10"
          />
        ) : (
          <span className="relative z-10 text-white/20 text-xs uppercase tracking-widest">
            No Image
          </span>
        )}
      </div>

      <div className="max-w-md shrink-0">
        <div className="text-[11px] text-white/45 uppercase tracking-[0.24em] mb-1.5 font-semibold">
          {("brand" in item ? item.brand : (item as GarmentTileItem).category) ||
            "Curated Selection"}
        </div>
        <h2 className="text-3xl font-light leading-tight text-white/90">
          {item.name}
        </h2>
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

function CardImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={proxied(src)}
      alt={alt}
      loading="lazy"
      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.opacity = "0.15";
      }}
    />
  );
}

function WardrobeContent({
  outfits,
  wide,
}: {
  outfits: OutfitTileItem[];
  wide?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const outfit = outfits[index] ?? outfits[0];

  if (!outfit) return null;

  if (wide && outfits.length > 1) {
    return (
      <div className="flex gap-5 h-full min-h-0 relative z-10">
        <div className="relative flex-[1.45] min-w-0 rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-white/20 transition-colors">
          <CardImage src={outfit.imageUrl} alt={outfit.name} />
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <p className="text-white font-bold text-2xl leading-snug truncate drop-shadow-md">
              {outfit.name}
            </p>
            {outfit.vibe && (
              <p className="text-white/70 text-sm mt-1 truncate uppercase tracking-wider text-[11px] font-semibold">
                {outfit.vibe}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 flex-1 min-w-0 overflow-y-auto scrollbar-hidden pr-1">
          {outfits.slice(0, 5).map((o, i) => (
            <button
              key={o.id}
              onClick={() => setIndex(i)}
              className={`group/btn grid grid-cols-[72px_1fr] gap-4 shrink-0 rounded-2xl overflow-hidden border transition-all text-left ${
                i === index
                  ? "border-white/40 ring-1 ring-white/20 bg-white/10"
                  : "border-white/10 opacity-70 hover:opacity-100 hover:bg-white/5"
              }`}
            >
              <div
                className="bg-white/5 overflow-hidden"
                style={{ aspectRatio: "3/4" }}
              >
                <img
                  src={proxied(o.imageUrl)}
                  alt={o.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/btn:scale-110"
                />
              </div>
              <div className="min-w-0 py-3 pr-4 flex flex-col justify-center">
                <p className="text-white text-[15px] font-semibold truncate drop-shadow-sm">
                  {o.name}
                </p>
                {o.vibe && (
                  <p className="text-white/60 text-[10px] uppercase tracking-widest truncate mt-0.5 font-medium">
                    {o.vibe}
                  </p>
                )}
                {o.reason && (
                  <p className="text-white/50 text-xs line-clamp-2 mt-1.5 leading-relaxed">
                    {o.reason}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 relative z-10">
      <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
        {outfit.imageUrl ? (
          <CardImage src={outfit.imageUrl} alt={outfit.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <WandSparkles className="w-12 h-12 text-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-white font-bold text-xl leading-snug truncate drop-shadow-md">
            {outfit.name}
          </p>
          {outfit.vibe && (
            <p className="text-white/70 text-[10px] font-semibold tracking-widest mt-1 truncate uppercase">
              {outfit.vibe}
            </p>
          )}
        </div>
      </div>

      {outfit.reason && (
        <p className="text-white/50 text-sm line-clamp-2 px-1 shrink-0 font-medium leading-relaxed">
          {outfit.reason}
        </p>
      )}

      {outfit.garments.length > 0 && (
        <div className="flex gap-3 overflow-x-auto shrink-0 pb-1 scrollbar-hidden px-1">
          {outfit.garments.slice(0, 8).map((g) => (
            <div
              key={g.id}
              title={g.name}
              className="shrink-0 w-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30 transition-colors"
              style={{ aspectRatio: "3/4" }}
            >
              <CardImage src={g.imageUrl} alt={g.name} />
            </div>
          ))}
        </div>
      )}

      {outfits.length > 1 && (
        <div className="flex justify-center gap-2 shrink-0 pt-1">
          {outfits.slice(0, 6).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show outfit ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === index
                  ? "w-6 h-1.5 bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                  : "w-1.5 h-1.5 bg-white/20 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GarmentsContent({
  items,
  standalone,
  selectedId,
  onSelect,
}: {
  items: GarmentTileItem[];
  standalone?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (!items.length) return <EmptyTile text="No fashion pieces yet." />;

  return (
    <div
      className={`grid gap-4 relative z-10 ${standalone ? "h-full min-h-0 grid-cols-2 overflow-y-auto scrollbar-hidden pb-20 pr-2" : "grid-cols-4 overflow-hidden"}`}
    >
      {items.slice(0, standalone ? 15 : 8).map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect?.(item.id)}
          className={`min-w-0 flex flex-col transition-all group/item text-left ${
            standalone
              ? selectedId === item.id
                ? "scale-[1.03] ring-1 ring-white/30 rounded-2xl bg-white/10"
                : "opacity-60 hover:opacity-100"
              : "rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30"
          }`}
        >
          <div
            className={`${standalone ? "rounded-2xl" : "bg-white/[0.03]"} overflow-hidden`}
            style={{ aspectRatio: "3/4" }}
          >
            <img
              src={proxied(item.imageUrl)}
              alt={item.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-110"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = "0.15";
              }}
            />
          </div>
          <div className={standalone ? "pt-3 pb-2 px-2" : "px-2.5 py-2"}>
            <p
              className={`${standalone ? "text-white text-[13px]" : "text-white/80 text-[11px]"} font-semibold truncate tracking-wide`}
            >
              {item.name}
            </p>
          </div>
        </button>
      ))}
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
      className={`grid gap-5 content-start relative z-10 ${standalone ? "h-full min-h-0 grid-cols-2 overflow-y-auto scrollbar-hidden pb-20 pr-2" : "grid-cols-3 overflow-hidden"}`}
    >
      {items.slice(0, standalone ? 15 : 6).map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect?.(c.id)}
          className={`min-w-0 flex flex-col transition-all group/item text-left ${
            standalone
              ? selectedId === c.id
                ? "scale-[1.03] drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] ring-1 ring-white/30 rounded-3xl bg-white/5"
                : "opacity-60 hover:opacity-100"
              : "rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30"
          }`}
        >
          <div
            className={`${standalone ? "aspect-square rounded-3xl" : "aspect-square bg-white/[0.03]"} overflow-hidden`}
          >
            <img
              src={proxied(c.imageUrl)}
              alt={c.name}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-110"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = "0.15";
              }}
            />
          </div>
          <div
            className={
              standalone
                ? "pt-3 flex flex-col"
                : "px-3 py-2.5 shrink-0 bg-black/20"
            }
          >
            <p
              className={`text-white/90 ${standalone ? "text-base font-bold" : "text-[13px] font-bold"} truncate drop-shadow-sm`}
            >
              {c.name}
            </p>
            {c.brand && (
              <p
                className={`text-white/50 ${standalone ? "text-xs mt-1" : "text-[10px] mt-0.5"} font-semibold uppercase tracking-widest truncate`}
              >
                {c.brand}
              </p>
            )}
          </div>
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
          : "glass-card-strong neon-border-white rounded-[2rem] flex flex-col p-6 min-h-0 overflow-hidden relative group",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!standalone && (
        <>
          {/* Premium Glass Glare Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-white/[0.01] to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
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
  const garments = useOverviewStore((s) => s.garments);
  const outfits = useOverviewStore((s) => s.outfits);
  const cosmetics = useOverviewStore((s) => s.cosmetics);
  const skinAnalysis = useOverviewStore((s) => s.skinAnalysis);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const garmentItems = garments.data?.length
    ? garments.data
    : (outfits.data ?? []).flatMap((outfit) => outfit.garments);

  const wardrobeState: TileState<boolean> = {
    status: outfits.status,
    data: outfits.data?.length ? true : null,
    error: outfits.error,
  };
  const garmentsState: TileState<boolean> = {
    status: garments.status === "idle" ? outfits.status : garments.status,
    data: garmentItems.length ? true : null,
    error: garments.error,
  };

  const showGarments =
    garmentsState.status === "loading" ||
    garmentsState.status === "error" ||
    garmentItems.length > 0;

  const showCosmetics =
    cosmetics.status === "loading" ||
    cosmetics.status === "error" ||
    (cosmetics.data && cosmetics.data.length > 0);

  const showWardrobe =
    wardrobeState.status === "loading" ||
    wardrobeState.status === "error" ||
    (outfits.data && outfits.data.length > 0);

  const visibleCount = [showGarments, showCosmetics, showWardrobe].filter(
    Boolean,
  ).length;
  const isStandalone = visibleCount === 1;

  const activeItem =
    garmentItems.find((i) => i.id === selectedItemId) ||
    cosmetics.data?.find((i) => i.id === selectedItemId) ||
    (showGarments ? garmentItems[0] : cosmetics.data?.[0]) ||
    null;

  return (
    <div
      className={
        isStandalone
          ? "flex w-full h-full"
          : "grid grid-cols-1 lg:grid-cols-2 grid-rows-none lg:grid-rows-2 gap-5 flex-1 min-h-0 p-4"
      }
    >
      {isStandalone ? (
        <>
          {showGarments && (
            <>
              <Tile
                icon={ShoppingBag}
                label="Fashion Pieces"
                state={garmentsState}
                className="w-[25%] h-full shrink-0"
                delay={0.1}
                standalone
              >
                <GarmentsContent
                  items={garmentItems}
                  standalone
                  selectedId={activeItem?.id}
                  onSelect={setSelectedItemId}
                />
              </Tile>
              <div className="w-[50%] flex flex-col">
                <StandaloneDetailsPane item={activeItem} />
              </div>
              <div className="w-[25%] shrink-0" />
            </>
          )}

          {showCosmetics && (
            <>
              <div className="w-[25%] shrink-0" />
              <div className="w-[50%] flex flex-col">
                <StandaloneDetailsPane item={activeItem} />
              </div>
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
                    selectedId={activeItem?.id}
                    onSelect={setSelectedItemId}
                  />
                ) : (
                  <EmptyTile text="No cosmetic picks yet." />
                )}
              </Tile>
            </>
          )}

          {showWardrobe && (
            <>
              <div className="w-[25%] shrink-0" />
              <Tile
                icon={WandSparkles}
                label="AI Wardrobe Planner"
                state={wardrobeState}
                className="w-[75%] h-full shrink-0"
                delay={0.3}
                standalone
              >
                {outfits.data?.length ? (
                  <WardrobeContent outfits={outfits.data} wide />
                ) : (
                  <EmptyTile text="No outfits yet." />
                )}
              </Tile>
            </>
          )}
        </>
      ) : (
        <>
          {showGarments && (
            <Tile
              icon={ShoppingBag}
              label="Fashion Pieces"
              state={garmentsState}
              className="col-span-1"
              delay={0.1}
            >
              <GarmentsContent items={garmentItems} />
            </Tile>
          )}

          {showCosmetics && (
            <Tile
              icon={Sparkles}
              label="Skin Routine"
              state={cosmetics}
              className="col-span-1"
              delay={0.2}
              rightContent={
                skinAnalysis.data?.skinType && (
                  <div className="px-2.5 py-1 rounded-lg bg-white/10 text-white/90 text-[10px] font-bold uppercase tracking-wider border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)]">
                    {skinAnalysis.data.skinType}
                  </div>
                )
              }
            >
              {cosmetics.data?.length ? (
                <CosmeticsStrip items={cosmetics.data} />
              ) : (
                <EmptyTile text="No cosmetic picks yet." />
              )}
            </Tile>
          )}

          {showWardrobe && (
            <Tile
              icon={WandSparkles}
              label="AI Wardrobe Planner"
              state={wardrobeState}
              className="col-span-1 lg:col-span-2"
              delay={0.3}
            >
              {outfits.data?.length ? (
                <WardrobeContent outfits={outfits.data} wide={false} />
              ) : (
                <EmptyTile text="No outfits yet." />
              )}
            </Tile>
          )}
        </>
      )}
    </div>
  );
}
