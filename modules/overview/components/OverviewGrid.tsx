"use client";

import { useState } from "react";
import {
  AlertCircle,
  Droplets,
  MapPin,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useOverviewStore } from "../store/useOverviewStore";
import type {
  CosmeticTileItem,
  MapTileData,
  OutfitTileItem,
  SkinAnalysisTileItem,
  TileState,
} from "../types";

const proxied = (url: string) =>
  `/api/proxy-image?url=${encodeURIComponent(url)}`;

function isActive(status: TileState<unknown>["status"]) {
  return status === "loading" || status === "ready" || status === "error";
}

function TileHeader({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-3 shrink-0">
      <div className="icon-box !w-10 !h-10 flex items-center justify-center rounded-xl">
        <Icon className="w-5 h-5 text-white" strokeWidth={1.5} />
      </div>
      <span className="text-white/45 text-[11px] font-semibold uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

function TileSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 flex-1">
      <div
        className="w-full rounded-2xl bg-white/5"
        style={{ aspectRatio: "3/2" }}
      />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-full bg-white/6"
          style={{ width: `${78 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

function TileError({ text }: { text: string }) {
  return (
    <div className="h-full min-h-[120px] flex flex-col items-center justify-center gap-2 text-center">
      <AlertCircle className="w-5 h-5 text-white/50" />
      <p className="text-white/55 text-sm max-w-[80%]">{text}</p>
    </div>
  );
}

function CardImage({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxied(src)}
      alt={alt}
      loading="lazy"
      className="w-full h-full object-cover"
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
      <div className="flex gap-4 h-full min-h-0">
        <div className="relative flex-[1.45] min-w-0 rounded-2xl overflow-hidden bg-white/3">
          <CardImage src={outfit.imageUrl} alt={outfit.name} />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p className="text-white font-semibold text-xl leading-snug truncate">
              {outfit.name}
            </p>
            {outfit.vibe && (
              <p className="text-white/50 text-sm mt-0.5 truncate">
                {outfit.vibe}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-0 overflow-y-auto">
          {outfits.slice(0, 5).map((o, i) => (
            <button
              key={o.id}
              onClick={() => setIndex(i)}
              className={`grid grid-cols-[64px_1fr] gap-3 shrink-0 rounded-xl overflow-hidden border transition-all text-left ${
                i === index
                  ? "border-white/30 ring-1 ring-white/20"
                  : "border-white/10 opacity-60 hover:opacity-80"
              }`}
            >
              <div className="bg-white/3" style={{ aspectRatio: "3/4" }}>
                <CardImage src={o.imageUrl} alt={o.name} />
              </div>
              <div className="min-w-0 py-2.5 pr-3 flex flex-col justify-center">
                <p className="text-white text-sm font-medium truncate">
                  {o.name}
                </p>
                {o.vibe && (
                  <p className="text-white/60 text-xs truncate">{o.vibe}</p>
                )}
                {o.reason && (
                  <p className="text-white/55 text-[11px] line-clamp-2 mt-0.5">
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
    <div className="flex flex-col h-full gap-3">
      <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-white/3">
        {outfit.imageUrl ? (
          <CardImage src={outfit.imageUrl} alt={outfit.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <WandSparkles className="w-12 h-12 text-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-white font-semibold text-xl leading-snug truncate">
            {outfit.name}
          </p>
          {outfit.vibe && (
            <p className="text-white/50 text-sm mt-0.5 truncate">
              {outfit.vibe}
            </p>
          )}
        </div>
      </div>

      {outfit.reason && (
        <p className="text-white/35 text-xs line-clamp-2 px-0.5 shrink-0">
          {outfit.reason}
        </p>
      )}

      {outfit.garments.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto shrink-0 pb-0.5 scrollbar-hidden">
          {outfit.garments.slice(0, 8).map((g) => (
            <div
              key={g.id}
              title={g.name}
              className="shrink-0 w-14 rounded-xl overflow-hidden bg-white/3 border border-white/10"
              style={{ aspectRatio: "3/4" }}
            >
              <CardImage src={g.imageUrl} alt={g.name} />
            </div>
          ))}
        </div>
      )}

      {outfits.length > 1 && (
        <div className="flex justify-center gap-1.5 shrink-0">
          {outfits.slice(0, 6).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show outfit ${i + 1}`}
              className={`rounded-full transition-all duration-200 ${
                i === index
                  ? "w-5 h-1.5 bg-white/60"
                  : "w-1.5 h-1.5 bg-white/20 hover:bg-white/35"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkinContent({
  item,
  wide,
}: {
  item: SkinAnalysisTileItem;
  wide?: boolean;
}) {
  const bars = (
    <div className="space-y-3">
      {[
        { label: "Hydration", value: item.hydrationPct, icon: Droplets },
        { label: "Oiliness", value: item.oilinessPct, icon: Zap },
      ].map(({ label, value, icon: Icon }) => (
        <div key={label}>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="flex items-center gap-1.5 text-white/45">
              <Icon className="w-3.5 h-3.5" /> {label}
            </span>
            <span className="text-white/60 font-mono">{value}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/6 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-blue-400/70"
              initial={{ width: 0 }}
              animate={{ width: `${value}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  const concerns = item.concerns.length > 0 && (
    <div className="flex flex-wrap gap-1.5">
      {item.concerns.slice(0, wide ? 8 : 4).map((c) => (
        <span
          key={c}
          className="text-xs text-white/50 bg-white/4 border border-white/10 px-2.5 py-1 rounded-lg"
        >
          {c}
        </span>
      ))}
    </div>
  );

  if (wide) {
    return (
      <div className="flex gap-6 h-full">
        <div className="flex flex-col items-center gap-3 shrink-0 justify-center">
          {item.skinTone && (
            <div
              className="w-20 h-20 rounded-3xl border-2 border-white/15 shadow-xl"
              style={{
                backgroundColor: item.skinTone.startsWith("#")
                  ? item.skinTone
                  : `#${item.skinTone}`,
              }}
            />
          )}
          <p className="text-white text-base font-semibold text-center leading-tight">
            {item.skinType}
          </p>
          {item.skinTone && (
            <p className="text-white/30 text-[10px] font-mono uppercase tracking-widest text-center">
              {item.skinTone}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4 flex-1 min-w-0 justify-center">
          {bars}
          {concerns}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 shrink-0">
        {item.skinTone && (
          <div
            className="w-12 h-12 rounded-2xl shrink-0 border border-white/15 shadow-md"
            style={{
              backgroundColor: item.skinTone.startsWith("#")
                ? item.skinTone
                : `#${item.skinTone}`,
            }}
          />
        )}
        <div className="min-w-0">
          <p className="text-white text-base font-semibold truncate">
            {item.skinType}
          </p>
          {item.skinTone && (
            <p className="text-white/30 text-[11px] font-mono uppercase tracking-widest mt-0.5">
              {item.skinTone}
            </p>
          )}
        </div>
      </div>
      {bars}
      {concerns && <div className="mt-auto">{concerns}</div>}
    </div>
  );
}

function MapContent({ data, wide }: { data: MapTileData; wide?: boolean }) {
  const pin = (size: number) => (
    <div
      className="relative rounded-2xl overflow-hidden flex items-center justify-center shrink-0"
      style={{
        height: size,
        width: size,
        background:
          "radial-gradient(ellipse at 35% 45%, rgba(96,140,255,0.14), transparent 70%)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <MapPin
          className="text-blue-300 drop-shadow-lg"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      </motion.div>
      <motion.div
        className="absolute bottom-3 w-6 h-0.5 rounded-full bg-blue-400/25"
        animate={{ scaleX: [1, 0.6, 1], opacity: [0.5, 0.2, 0.5] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="absolute top-2 right-3 text-[10px] text-white/20 font-mono">
        {data.lat.toFixed(3)}, {data.lng.toFixed(3)}
      </span>
    </div>
  );

  const stopList = data.stops && data.stops.length > 1 && (
    <div className="space-y-1.5 border-t border-white/5 pt-3 overflow-y-auto">
      {data.stops.slice(0, wide ? 6 : 5).map((s, i, arr) => (
        <div key={`${s.name}-${i}`} className="flex items-start gap-3">
          <div className="flex flex-col items-center shrink-0 mt-1">
            <div className="w-2 h-2 rounded-full bg-blue-400/70" />
            {i < arr.length - 1 && (
              <div className="w-px h-3 bg-white/10 mt-0.5" />
            )}
          </div>
          <span className="text-white/45 text-sm truncate">{s.name}</span>
        </div>
      ))}
    </div>
  );

  if (wide) {
    return (
      <div className="flex gap-5 h-full">
        {pin(180)}
        <div className="flex flex-col gap-3 flex-1 min-w-0 justify-start pt-1">
          <div>
            <p className="text-white text-xl font-bold truncate">{data.name}</p>
            {data.address && (
              <p className="text-white/35 text-sm truncate mt-0.5">
                {data.address}
              </p>
            )}
          </div>
          {stopList}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {pin(100)}
      <div className="shrink-0">
        <p className="text-white text-base font-semibold truncate">
          {data.name}
        </p>
        {data.address && (
          <p className="text-white/35 text-sm truncate mt-0.5">
            {data.address}
          </p>
        )}
      </div>
      {stopList}
    </div>
  );
}

function CosmeticsStrip({ items }: { items: CosmeticTileItem[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto h-full scrollbar-hidden">
      {items.slice(0, 10).map((c) => (
        <div
          key={c.id}
          className="shrink-0 flex flex-col rounded-2xl overflow-hidden bg-white/3 border border-white/10"
          style={{ width: 100 }}
        >
          <div
            className="flex-1 min-h-0 bg-white/2"
            style={{ aspectRatio: "1" }}
          >
            <CardImage src={c.imageUrl} alt={c.name} />
          </div>
          <div className="px-2.5 py-2 shrink-0">
            <p className="text-white text-xs font-medium truncate">{c.name}</p>
            {c.brand && (
              <p className="text-white/50 text-[11px] truncate capitalize">
                {c.brand}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Tile({
  icon,
  label,
  state,
  skeletonRows,
  children,
  className,
}: {
  icon: React.ElementType;
  label: string;
  state: TileState<unknown>;
  skeletonRows?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "glass-card-strong neon-border-white rounded-3xl flex flex-col p-5 min-h-0 overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <TileHeader icon={icon} label={label} />
      <div className="flex-1 min-h-0 flex flex-col">
        {state.status === "loading" ? (
          <TileSkeleton rows={skeletonRows} />
        ) : state.status === "error" ? (
          <TileError text={state.error ?? "Something went wrong"} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function OverviewGrid() {
  const outfits = useOverviewStore((s) => s.outfits);
  const cosmetics = useOverviewStore((s) => s.cosmetics);
  const skinAnalysis = useOverviewStore((s) => s.skinAnalysis);
  const map = useOverviewStore((s) => s.map);

  const wardrobeState: TileState<boolean> = {
    status: outfits.status,
    data: outfits.data?.length ? true : null,
    error: outfits.error,
  };

  const showWardrobe = isActive(wardrobeState.status);
  const showSkin = isActive(skinAnalysis.status);
  const showMap = isActive(map.status);
  const showCosmetics = isActive(cosmetics.status);
  const showSideRow = showSkin || showMap;
  const wardrobeWide =
    showWardrobe && !showSideRow && outfits.data && outfits.data.length > 1;
  const skinWide = showSkin && !showMap;
  const mapWide = showMap && !showSkin;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {showWardrobe && (
        <Tile
          icon={WandSparkles}
          label="Wardrobe"
          state={wardrobeState}
          skeletonRows={2}
          className={showSideRow ? "flex-2" : "flex-1"}
        >
          {outfits.data?.length ? (
            <WardrobeContent
              outfits={outfits.data}
              wide={wardrobeWide ?? false}
            />
          ) : null}
        </Tile>
      )}

      {showSideRow && (
        <div
          className={`flex gap-3 min-h-0 ${showWardrobe ? "flex-1" : "flex-2"}`}
        >
          {showSkin && (
            <Tile
              icon={Sparkles}
              label="Skin Profile"
              state={skinAnalysis}
              skeletonRows={3}
              className="flex-1"
            >
              {skinAnalysis.data ? (
                <SkinContent item={skinAnalysis.data} wide={skinWide} />
              ) : null}
            </Tile>
          )}

          {showMap && (
            <Tile
              icon={MapPin}
              label="Map"
              state={map}
              skeletonRows={2}
              className="flex-1"
            >
              {map.data ? <MapContent data={map.data} wide={mapWide} /> : null}
            </Tile>
          )}
        </div>
      )}

      {showCosmetics && (
        <div
          className="glass-card-strong neon-border-white rounded-3xl shrink-0 px-5 pt-4 pb-4 flex flex-col"
          style={{ height: 184 }}
        >
          <TileHeader icon={Sparkles} label="Cosmetics" />
          <div className="flex-1 min-h-0">
            {cosmetics.status === "loading" ? (
              <div className="flex gap-3 h-full animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="shrink-0 rounded-2xl bg-white/4"
                    style={{ width: 100, aspectRatio: "1" }}
                  />
                ))}
              </div>
            ) : cosmetics.status === "error" ? (
              <TileError text={cosmetics.error ?? "Something went wrong"} />
            ) : cosmetics.data?.length ? (
              <CosmeticsStrip items={cosmetics.data} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
