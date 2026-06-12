export const ROUTES = {
  AI_ASSISTANT: "/ai-assistant",
  AI_RECOMMENDATION_FASHION: "/ai-recommendation-fashion",
  FASHION_CATALOG: "/fashion-catalog",
  AI_RECOMMENDATION_COSMETIC: "/ai-recommendation-cosmetic",
  COSMETIC_PRODUCTS: "/cosmetic-products",
  MAP: "/map",
  OVERVIEW: "/overview",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Flat list of the app's navigable routes, sent to ChatWonder as
 * `sitemap_context`. Note: the canonical navigation path is the Stylist persona's
 * `[STYLIST]` block (which uses its own route list); `sitemap_context` only feeds
 * the legacy `[NAV_DATA]` fallback.
 */
export const SITEMAP_CONTEXT: string[] = [
  `${ROUTES.AI_ASSISTANT} (home / AI assistant)`,
  `${ROUTES.AI_RECOMMENDATION_FASHION} (fashion outfit recommendations)`,
  `${ROUTES.FASHION_CATALOG} (fashion catalog browse)`,
  `${ROUTES.AI_RECOMMENDATION_COSMETIC} (skincare & cosmetics AI)`,
  `${ROUTES.COSMETIC_PRODUCTS} (cosmetics products browse)`,
  `${ROUTES.MAP} (map & navigation)`,
  `${ROUTES.OVERVIEW} (combined overview of all recommendations)`,
];

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
