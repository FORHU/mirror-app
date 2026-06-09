"use client";

import { usePathname, useRouter } from "next/navigation";
import { Shirt, Sparkles, MapPin, LayoutDashboard, Mic } from "lucide-react";
import { ROUTES } from "@/navigation";

const NAV_ITEMS = [
  { icon: Mic, route: ROUTES.WELCOME, label: "Assistant" },
  { icon: Shirt, route: ROUTES.AI_RECOMMENDATION_FASHION, label: "Fashion" },
  {
    icon: Sparkles,
    route: ROUTES.AI_RECOMMENDATION_COSMETIC,
    label: "Cosmetics",
  },
  { icon: MapPin, route: ROUTES.MAP, label: "Map" },
  { icon: LayoutDashboard, route: ROUTES.OVERVIEW, label: "Overview" },
];

export default function MirrorSideNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      className="fixed top-0 right-0 z-40 flex flex-col items-center justify-center gap-1"
      style={{
        width: 80,
        height: "100dvh",
        background: "rgba(8,8,8,0.96)",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {NAV_ITEMS.map(({ icon: Icon, route, label }) => {
        const isActive = pathname === route;
        return (
          <button
            key={route}
            type="button"
            onClick={() => router.push(route)}
            onTouchStart={() => router.push(route)}
            aria-label={label}
            className="relative flex flex-col items-center justify-center gap-1.5 w-full transition-colors"
            style={{
              height: 104,
              background: isActive ? "rgba(79,195,247,0.07)" : "transparent",
            }}
          >
            {/* Active indicator bar on left edge */}
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                style={{
                  height: 36,
                  background:
                    "linear-gradient(to bottom, var(--color-brand-core, #a855f7), var(--color-brand-vibrant, #ec4899))",
                }}
              />
            )}

            <Icon
              className="w-5 h-5 transition-colors"
              strokeWidth={isActive ? 2 : 1.5}
              style={{
                color: isActive
                  ? "rgba(79,195,247,0.85)"
                  : "rgba(255,255,255,0.35)",
                filter: isActive
                  ? "drop-shadow(0 0 6px rgba(79,195,247,0.6))"
                  : "none",
              }}
            />
            <span
              className="text-[9px] uppercase tracking-[0.15em] font-medium leading-none"
              style={{
                color: isActive
                  ? "rgba(255,255,255,0.85)"
                  : "rgba(255,255,255,0.25)",
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
