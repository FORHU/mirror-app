"use client";

import { useState } from "react";
import {
  AlertCircle,
  ShoppingBag,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useOverviewStore } from "../store/useOverviewStore";
import type {
  CosmeticTileItem,
  GarmentTileItem,
  OutfitTileItem,
  TileState,
} from "../types";

const proxied = (url: string) =>
  `/api/proxy-image?url=${encodeURIComponent(url)}`;

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

function EmptyTile({ text }: { text: string }) {
  return (
    <div className="h-full min-h-[120px] flex items-center justify-center text-center">
      <p className="text-white/35 text-sm max-w-[220px] leading-relaxed">
        {text}
      </p>
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

function GarmentsContent({ items }: { items: GarmentTileItem[] }) {
  if (!items.length) return <EmptyTile text="No fashion pieces yet." />;

  return (
    <div className="grid grid-cols-4 gap-2.5 overflow-hidden">
      {items.slice(0, 8).map((item) => (
        <div
          key={item.id}
          className="min-w-0 rounded-2xl overflow-hidden bg-white/3 border border-white/10"
        >
          <div className="bg-white/2" style={{ aspectRatio: "3/4" }}>
            <CardImage src={item.imageUrl} alt={item.name} />
          </div>
          <div className="px-2 py-1.5">
            <p className="text-white/75 text-[11px] font-medium truncate">
              {item.name}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CosmeticsStrip({ items }: { items: CosmeticTileItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 overflow-hidden content-start">
      {items.slice(0, 6).map((c) => (
        <div
          key={c.id}
          className="min-w-0 flex flex-col rounded-2xl overflow-hidden bg-white/3 border border-white/10"
        >
          <div className="h-[112px] bg-white/2">
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
  children,
  className,
}: {
  icon: React.ElementType;
  label: string;
  state: TileState<unknown>;
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
          <TileSkeleton />
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
  const garments = useOverviewStore((s) => s.garments);
  const outfits = useOverviewStore((s) => s.outfits);
  const cosmetics = useOverviewStore((s) => s.cosmetics);

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

  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-3 flex-1 min-h-0">
      <Tile icon={ShoppingBag} label="Fashion" state={garmentsState}>
        <GarmentsContent items={garmentItems} />
      </Tile>

      <Tile icon={WandSparkles} label="Outfits" state={wardrobeState}>
        {outfits.data?.length ? (
          <WardrobeContent outfits={outfits.data} />
        ) : (
          <EmptyTile text="No outfits yet." />
        )}
      </Tile>

      <Tile
        icon={Sparkles}
        label="Cosmetics"
        state={cosmetics}
        className="col-span-2"
      >
        {cosmetics.data?.length ? (
          <CosmeticsStrip items={cosmetics.data} />
        ) : (
          <EmptyTile text="No cosmetic picks yet." />
        )}
      </Tile>
    </div>
  );
}
