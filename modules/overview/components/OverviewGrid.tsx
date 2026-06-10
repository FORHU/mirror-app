"use client";

import {
  WandSparkles,
  MapPin,
  AlertCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useOverviewStore } from "../store/useOverviewStore";
import type {
  MapTileData,
  OutfitTileItem,
  CosmeticTileItem,
  SkinAnalysisTileItem,
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
          <p className="text-white/55 text-xs truncate">{subtitle}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-5 pb-5 mirror-scroll">
        {status === "idle" || status === "loading" ? (
          <TileSkeleton />
        ) : status === "error" ? (
          <TileMessage
            icon={AlertCircle}
            text={error ?? "Something went wrong"}
          />
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
  className,
}: {
  children: React.ReactNode;
  focused: boolean;
  className?: string;
}) {
  return (
    <motion.div
      layout
      className={[
        "min-h-0",
        focused
          ? "h-full w-full max-w-[620px] max-h-[690px] justify-self-center"
          : "h-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
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
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60"
        >
          <Icon className="h-3.5 w-3.5 text-white/60" strokeWidth={1.5} />
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

function TileMessage({
  icon: Icon,
  text,
}: {
  icon?: LucideIcon;
  text: string;
}) {
  return (
    <div className="h-full min-h-[120px] flex flex-col items-center justify-center gap-2 text-center">
      {Icon && <Icon className="w-5 h-5 text-white/50" />}
      <p className="text-white/55 text-sm max-w-[80%]">{text}</p>
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

// ── Cosmetics tile ──────────────────────────────────────────────────────────────────────────────────

function CosmeticsContent({ items }: { items: CosmeticTileItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.slice(0, 6).map((c) => (
        <div
          key={c.id}
          className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10"
        >
          <div style={{ aspectRatio: "1" }} className="bg-white/[0.02]">
            <CardImage src={c.imageUrl} alt={c.name} />
          </div>
          <div className="px-2.5 py-2">
            <p className="text-white text-xs font-medium truncate">{c.name}</p>
            {c.brand && (
              <p className="text-white/60 text-[11px] truncate capitalize">
                {c.brand}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Wardrobe tile (outfit-first: each look shows its own pieces) ───────────────

function WardrobeContent({ outfits }: { outfits: OutfitTileItem[] }) {
  return (
    <div className="space-y-3">
      {outfits.slice(0, 4).map((o) => (
        <div
          key={o.id}
          className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10"
        >
          <div className="flex gap-3">
            <div
              className="shrink-0 bg-white/[0.02]"
              style={{ width: 84, aspectRatio: "3 / 4" }}
            >
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
          </div>

          {o.garments.length > 0 && (
            <div className="flex gap-2 px-3 pb-3 pt-1 overflow-x-auto">
              {o.garments.slice(0, 6).map((g) => (
                <div
                  key={g.id}
                  className="shrink-0 rounded-lg overflow-hidden bg-white/[0.02] border border-white/10"
                  style={{ width: 48, aspectRatio: "3 / 4" }}
                  title={g.name}
                >
                  <CardImage src={g.imageUrl} alt={g.name} />
                </div>
              ))}
            </div>
          )}
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
        <span className="absolute bottom-2 right-3 text-[11px] text-white/60 font-mono">
          {data.lat.toFixed(3)}, {data.lng.toFixed(3)}
        </span>
      </div>

      <div>
        <p className="text-white text-sm font-medium truncate">{data.name}</p>
        {data.address && (
          <p className="text-white/60 text-xs truncate">{data.address}</p>
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

// ── Skin Analysis ─────────────────────────────────────────────────────────────

function SkinAnalysisContent({ item }: { item: SkinAnalysisTileItem }) {
  return (
    <div className="flex flex-col h-full gap-4 relative">
      {item.imageUrl && (
        <div className="absolute -right-4 -bottom-4 w-32 h-32 rounded-full overflow-hidden opacity-20 blur-xl pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxied(item.imageUrl)}
            className="w-full h-full object-cover"
            alt="Scan Profile"
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-2 z-10">
        <div>
          <h4 className="text-white font-semibold text-sm tracking-wide">
            {item.skinType}
          </h4>
          <p className="text-white/50 text-[11px] uppercase tracking-widest mt-0.5">
            Profile
          </p>
        </div>
        {item.skinTone && (
          <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1.5 rounded-full border border-white/10">
            <div
              className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
              style={{
                backgroundColor: item.skinTone.startsWith("#")
                  ? item.skinTone
                  : `#${item.skinTone}`,
              }}
            />
            <span className="text-white/80 text-xs font-mono uppercase tracking-widest">
              {item.skinTone}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4 z-10 flex-1">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/70">Hydration</span>
            <span className="text-white/90 font-mono">
              {item.hydrationPct}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400/80 rounded-full"
              style={{ width: `${item.hydrationPct}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/70">Sebum (Oil) Level</span>
            <span className="text-white/90 font-mono">{item.oilinessPct}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400/80 rounded-full"
              style={{ width: `${item.oilinessPct}%` }}
            />
          </div>
        </div>
      </div>

      {item.concerns.length > 0 && (
        <div className="mt-auto z-10">
          <h5 className="text-white/50 text-[11px] uppercase tracking-widest mb-2 font-semibold">
            Active Concerns
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {item.concerns.map((c) => (
              <span
                key={c}
                className="text-[11px] text-white/80 bg-white/5 border border-white/10 px-2 py-1 rounded-md"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grid ─────────────────────────────────────────────────────────────────────

export function OverviewGrid() {
  const outfits = useOverviewStore((s) => s.outfits);
  const cosmetics = useOverviewStore((s) => s.cosmetics);
  const skinAnalysis = useOverviewStore((s) => s.skinAnalysis);
  const map = useOverviewStore((s) => s.map);

  // Wardrobe is now outfit-driven; each outfit carries its own garments, so the
  // tile's state is simply the outfits slice.
  const wardrobeState = {
    status: outfits.status,
    data: outfits.data?.length ? true : null,
    error: outfits.error,
  };

  const tiles = [
    {
      key: "wardrobe",
      title: "Wardrobe",
      subtitle: "Styled looks and their pieces",
      icon: WandSparkles,
      state: wardrobeState,
      empty: "No wardrobe recommendations yet.",
      content: wardrobeState.data ? (
        <WardrobeContent outfits={outfits.data || []} />
      ) : null,
    },
    {
      key: "cosmetics",
      title: "Cosmetics",
      subtitle: "Makeup matching your vibe",
      icon: Sparkles,
      state: cosmetics,
      empty: "No cosmetics recommended.",
      content: cosmetics.data ? (
        <CosmeticsContent items={cosmetics.data} />
      ) : null,
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
    {
      key: "skinAnalysis",
      title: "Skin Profile",
      subtitle: "Biometric Scan",
      icon: Sparkles,
      state: skinAnalysis,
      empty: "Scan not available",
      content: skinAnalysis.data ? (
        <SkinAnalysisContent item={skinAnalysis.data} />
      ) : null,
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
            : "grid-cols-1 md:grid-cols-[1.5fr_1fr] md:grid-rows-[minmax(0,2fr)_minmax(0,1fr)]",
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
