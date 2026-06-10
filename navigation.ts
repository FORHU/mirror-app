export const ROUTES = {
  WELCOME: "/ai-assistant",
  AI_RECOMMENDATION_FASHION: "/ai-recommendation-fashion",
  AI_RECOMMENDATION_COSMETIC: "/ai-recommendation-cosmetic",
  MAP: "/map",
  OVERVIEW: "/overview",
  WARDROBE_CREATE: "/wardrobe/create",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Flat list of the app's navigable routes, sent to ChatWonder as
 * `sitemap_context`. Note: the canonical navigation path is the Stylist persona's
 * `[STYLIST]` block (which uses its own route list); `sitemap_context` only feeds
 * the legacy `[NAV_DATA]` fallback.
 */
export const SITEMAP_CONTEXT: string[] = Object.values(ROUTES);

const ROUTE_VALUES = new Set<string>(Object.values(ROUTES));

/**
 * True when `target` is a real app route we can navigate to. Used to ignore
 * stale `[STYLIST]` targets (e.g. `/virtual-mirror`) the external ChatWonder
 * persona may still advertise after a screen has been removed.
 */
export function isKnownRoute(
  target: string | null | undefined,
): target is string {
  return typeof target === "string" && ROUTE_VALUES.has(target);
}

export const ROUTE_RULES = {
  protected: [ROUTES.AI_RECOMMENDATION_FASHION] as string[],
} as const;
