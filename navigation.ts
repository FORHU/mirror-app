export const ROUTES = {
  WELCOME: "/",
  SELECT_GENDER: "/select-gender",
  LOGGED_IN: "/authentication",
  AI_RECOMMENDATION_FASHION: "/ai-recommendation-fashion",
  AI_RECOMMENDATION_COSMETIC: "/ai-recommendation-cosmetic",
  AI_RECOMMENDATION_COSMETIC_RESULT: "/ai-recommendation-cosmetic/result",
  OVERVIEW: "/overview",
  MAP: "/map",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const ROUTE_RULES = {
  protected: [
    ROUTES.LOGGED_IN,
    ROUTES.OVERVIEW,
    ROUTES.AI_RECOMMENDATION_FASHION,
    ROUTES.AI_RECOMMENDATION_COSMETIC,
    ROUTES.AI_RECOMMENDATION_COSMETIC_RESULT,
  ] as string[],
} as const;
