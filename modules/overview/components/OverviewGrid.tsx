"use client";

import {
  Sparkles,
  Shirt,
  WandSparkles,
  MapPin,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useOverviewStore } from "../store/useOverviewStore";
import type {
  CosmeticsTileData,
  GarmentTileItem,
  MapTileData,
  OutfitTileItem,
  TileState,
} from "../types";

// Remote tool images are served through the app's sharp-backed proxy so the
// kiosk never hits cross-origin CDNs directly.
const proxied = (url: string) =>
  `/api/proxy-image?url=${encodeURIComponent(url)}`;

// ── Tile shell ────────────────────────────────────────────────────────────────

function TileShell({
  title,
  subtitle,
  icon: Icon,
  status,
  error,
  children,
  empty,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  status: TileState<unknown>["status"];
  error: string | null;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card-strong neon-border-white rounded-3xl flex h-full flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 shrink-0">
        <div className="icon-box !w-10 !h-10 flex items-center justify-center rounded-xl">
          <Icon className="w-5 h-5 text-white" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-lg leading-tight truncate">
            {title}
          </h3>
          <p className="text-white/35 text-xs truncate">{subtitle}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-5 pb-5 mirror-scroll">
        {status === "idle" || status === "loading" ? (
          <TileSkeleton />
        ) : status === "error" ? (
          <TileMessage icon={AlertCircle} text={error ?? "Something went wrong"} />
        ) : status === "empty" ? (
          <TileMessage text={empty} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function TileFrame({
  children,
  focused,
}: {
  children: React.ReactNode;
  focused: boolean;
}) {
  return (
    <motion.div
      layout
      className={[
        "min-h-0",
        focused
          ? "h-full w-full max-w-[620px] max-h-[690px] justify-self-center"
          : "h-full",
      ].join(" ")}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}

function PendingStrip({
  tiles,
}: {
  tiles: Array<{
    key: string;
    title: string;
    icon: LucideIcon;
    status: TileState<unknown>["status"];
  }>;
}) {
  if (!tiles.length) return null;

  return (
    <div className="shrink-0 flex flex-wrap items-center justify-center gap-2">
      {tiles.map(({ key, title, icon: Icon, status }) => (
        <div
          key={key}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45"
        >
          <Icon className="h-3.5 w-3.5 text-white/45" strokeWidth={1.5} />
          <span className="font-medium text-white/60">{title}</span>
          <span>
            {status === "loading"
              ? "loading"
              : status === "error"
                ? "needs attention"
                : status === "empty"
                  ? "no result"
                  : "waiting"}
          </span>
        </div>
      ))}
    </div>
  );
}

function TileMessage({ icon: Icon, text }: { icon?: LucideIcon; text: string }) {
  return (
    <div className="h-full min-h-[120px] flex flex-col items-center justify-center gap-2 text-center">
      {Icon && <Icon className="w-5 h-5 text-white/25" />}
      <p className="text-white/35 text-sm max-w-[80%]">{text}</p>
    </div>
  );
}

// ── Skeleton (the "waiting for the endpoint" state) ──────────────────────────

function TileSkeleton() {
  return (
    <div className="animate-pulse space-y-3 pt-1">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl"
            style={{
              aspectRatio: "3 / 4",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          />
        ))}
      </div>
      <div className="h-3 w-2/3 rounded-full bg-white/8" />
      <div className="h-3 w-1/2 rounded-full bg-white/6" />
    </div>
  );
}

// ── Card image with its own shimmer until loaded ─────────────────────────────

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

// ── Cosmetics tile ───────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2.5 py-1 rounded-full text-[11px] text-white/70 bg-white/5 border border-white/10">
      {children}
    </span>
  );
}

function CosmeticsContent({ data }: { data: CosmeticsTileData }) {
  const recs = (data.recommendations ?? []).slice(0, 4);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {data.skinType && <Chip>{data.skinType} skin</Chip>}
        {data.skinTone && <Chip>{data.skinTone} tone</Chip>}
        {typeof data.hydrationPct === "number" && (
          <Chip>{data.hydrationPct}% hydration</Chip>
        )}
        {typeof data.oilinessPct === "number" && (
          <Chip>{data.oilinessPct}% oil</Chip>
        )}
        {(data.concerns ?? []).slice(0, 3).map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
      </div>

      {recs.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {recs.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10"
            >
              <div className="aspect-square bg-white/[0.02]">
                {r.cosmeticProduct?.fileUrl?.fileUrl && (
                  <CardImage
                    src={r.cosmeticProduct.fileUrl.fileUrl}
                    alt={r.cosmeticProduct.name}
                  />
                )}
              </div>
              <div className="px-2.5 py-2">
                <p className="text-white text-xs font-medium truncate">
                  {r.cosmeticProduct?.name}
                </p>
                {r.cosmeticProduct?.brand && (
                  <p className="text-white/40 text-[11px] truncate">
                    {r.cosmeticProduct.brand}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.routineTip && (
        <p className="text-white/50 text-xs leading-relaxed border-t border-white/5 pt-3">
          {data.routineTip}
        </p>
      )}
    </div>
  );
}

// ── Garments tile ────────────────────────────────────────────────────────────

function GarmentsContent({ items }: { items: GarmentTileItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.slice(0, 6).map((g) => (
        <div
          key={g.id}
          className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10"
        >
          <div style={{ aspectRatio: "3 / 4" }} className="bg-white/[0.02]">
            <CardImage src={g.imageUrl} alt={g.name} />
          </div>
          <div className="px-2.5 py-2">
            <p className="text-white text-xs font-medium truncate">{g.name}</p>
            {g.category && (
              <p className="text-white/40 text-[11px] truncate capitalize">
                {g.category}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Outfits tile ─────────────────────────────────────────────────────────────

function OutfitsContent({ items }: { items: OutfitTileItem[] }) {
  return (
    <div className="space-y-3">
      {items.slice(0, 4).map((o) => (
        <div
          key={o.id}
          className="flex gap-3 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10"
        >
          <div
            className="shrink-0 bg-white/[0.02]"
            style={{ width: 84, aspectRatio: "3 / 4" }}
          >
            <CardImage src={o.imageUrl} alt={o.name} />
          </div>
          <div className="min-w-0 py-2.5 pr-3 flex flex-col justify-center">
            <p className="text-white text-sm font-medium truncate">{o.name}</p>
            {o.vibe && (
              <p className="text-white/45 text-xs truncate">{o.vibe}</p>
            )}
            {o.reason && (
              <p className="text-white/35 text-[11px] line-clamp-2 mt-0.5">
                {o.reason}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Map tile ─────────────────────────────────────────────────────────────────

function MapContent({ data }: { data: MapTileData }) {
  return (
    <div className="space-y-3">
      <div
        className="relative rounded-2xl overflow-hidden border border-white/10"
        style={{
          height: 130,
          background:
            "radial-gradient(120% 120% at 30% 20%, rgba(96,140,255,0.18), rgba(255,255,255,0.02) 70%)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            <MapPin className="w-8 h-8 text-blue-300" />
          </motion.div>
        </div>
        <span className="absolute bottom-2 right-3 text-[10px] text-white/40 font-mono">
          {data.lat.toFixed(3)}, {data.lng.toFixed(3)}
        </span>
      </div>

      <div>
        <p className="text-white text-sm font-medium truncate">{data.name}</p>
        {data.address && (
          <p className="text-white/40 text-xs truncate">{data.address}</p>
        )}
      </div>

      {data.stops && data.stops.length > 1 && (
        <ul className="space-y-1.5 border-t border-white/5 pt-3">
          {data.stops.slice(0, 4).map((s, i) => (
            <li
              key={`${s.name}-${i}`}
              className="flex items-center gap-2 text-white/55 text-xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span className="truncate">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Grid ─────────────────────────────────────────────────────────────────────

export function OverviewGrid() {
  const cosmetics = useOverviewStore((s) => s.cosmetics);
  const garments = useOverviewStore((s) => s.garments);
  const outfits = useOverviewStore((s) => s.outfits);
  const map = useOverviewStore((s) => s.map);

  const tiles = [
    {
      key: "cosmetics",
      title: "Cosmetics",
      subtitle: "Skin analysis & product picks",
      icon: Sparkles,
      state: cosmetics,
      empty: "No products matched your skin yet.",
      content: cosmetics.data ? <CosmeticsContent data={cosmetics.data} /> : null,
    },
    {
      key: "garments",
      title: "Garments",
      subtitle: "Pieces picked for your plan",
      icon: Shirt,
      state: garments,
      empty: "No garments recommended yet.",
      content: garments.data ? <GarmentsContent items={garments.data} /> : null,
    },
    {
      key: "outfits",
      title: "Outfits",
      subtitle: "Full looks, styled for the occasion",
      icon: WandSparkles,
      state: outfits,
      empty: "No complete looks yet.",
      content: outfits.data ? <OutfitsContent items={outfits.data} /> : null,
    },
    {
      key: "map",
      title: "Map",
      subtitle: "Where you're headed",
      icon: MapPin,
      state: map,
      empty: "No destination set yet.",
      content: map.data ? <MapContent data={map.data} /> : null,
    },
  ];

  const readyTiles = tiles.filter((tile) => tile.state.status === "ready");
  const pendingTiles = tiles.filter((tile) => tile.state.status !== "ready");
  const visibleTiles = readyTiles.length ? readyTiles : tiles;
  const focused = readyTiles.length === 1;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      <div
        className={[
          "grid flex-1 min-h-0 gap-4",
          focused
            ? "grid-cols-1 place-items-center"
            : "grid-cols-1 md:grid-cols-2",
        ].join(" ")}
      >
        {visibleTiles.map((tile) => (
          <TileFrame key={tile.key} focused={focused}>
            <TileShell
              title={tile.title}
              subtitle={tile.subtitle}
              icon={tile.icon}
              status={tile.state.status}
              error={tile.state.error}
              empty={tile.empty}
            >
              {tile.content}
            </TileShell>
          </TileFrame>
        ))}
      </div>

      {readyTiles.length > 0 && (
        <PendingStrip
          tiles={pendingTiles.map((tile) => ({
            key: tile.key,
            title: tile.title,
            icon: tile.icon,
            status: tile.state.status,
          }))}
        />
      )}
    </div>
  );
}
