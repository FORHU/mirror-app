export const ROUTES = {
  WELCOME: "/",
  SELECT_GENDER: "/select-gender",
  LOGGED_IN: "/authentication",
  AI_RECOMMENDATION_FASHION: "/ai-recommendation-fashion",
  AI_RECOMMENDATION_COSMETIC: "/ai-recommendation-cosmetic",
  AI_RECOMMENDATION_COSMETIC_RESULT: "/ai-recommendation-cosmetic/result",
  AI_RECOMMENDATION_COSMETIC_RECOMMENDATION:
    "/ai-recommendation-cosmetic/recommendation",
  OVERVIEW: "/overview",
  MIRROR_TEMPLATES: "/mirror-templates",
  QRCODE: "/qrcode",
  QRCODE_MIRROR_A: "/qrcode/mirror-a",
  MAP: "/map",
  AI_ASSISTANT: "/ai-assistant",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Flat list of the app's navigable routes, sent to ChatWonder as
 * `sitemap_context` so it can resolve `[nav]` requests to a real route.
 */
export const SITEMAP_CONTEXT: string[] = Object.values(ROUTES);

export const ROUTE_RULES = {
  protected: [
    ROUTES.LOGGED_IN,
    ROUTES.OVERVIEW,
    ROUTES.AI_RECOMMENDATION_FASHION,
    // TODO: re-add after frontend testing
    // ROUTES.AI_RECOMMENDATION_COSMETIC,
    // ROUTES.AI_RECOMMENDATION_COSMETIC_RESULT,
  ] as string[],
} as const;
