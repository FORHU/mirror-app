export const ROUTES = {
  WELCOME: "/",
  WAITING_LOGIN: "/waiting-login",
  LOGGED_IN: "/authentication",
  SELECT_GENDER: "/select-gender",
  WAITING_PERSONALIZE: "/waiting-personalize",
  PERSONALIZE_OUTFIT: "/personalize-outfit",
  VIRTUAL_MIRROR: "/virtual-mirror",
  AI_RECOMMENDATION_FASHION: "/ai-recommendation-fashion",
  AI_RECOMMENDATION_COSMETIC: "/ai-recommendation-cosmetic",
  AI_RECOMMENDATION_COSMETIC_RESULT: "/ai-recommendation-cosmetic/result",
  QRCODE: "/qrcode",
  MAP: "/map",
  DASHBOARD: "/dashboard",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const ROUTE_RULES = {
  protected: [
    ROUTES.WELCOME,
    ROUTES.SELECT_GENDER,
    ROUTES.LOGGED_IN,
    ROUTES.WAITING_PERSONALIZE,
    ROUTES.AI_RECOMMENDATION_FASHION,
    ROUTES.AI_RECOMMENDATION_COSMETIC,
    ROUTES.AI_RECOMMENDATION_COSMETIC_RESULT,
  ] as string[],
} as const;
