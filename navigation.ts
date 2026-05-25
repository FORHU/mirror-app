export const ROUTES = {
  WELCOME: "/",
  WAITING_LOGIN: "/waiting-login",
  LOGGED_IN: "/logged-in",
  EVENT_SETUP: "/event-setup",
  WAITING_PERSONALIZE: "/waiting-personalize",
  PERSONALIZE_OUTFIT: "/personalize-outfit",
  OUTFIT_BUILDER: "/outfit-builder",
  SAVE_OUTFIT: "/save-outfit",
  CAPTURE: "/capture",
  CAPTURE_PICTURE: "/capture-picture",
  TRY_IT_ON: "/try-it-on",
  VIRTUAL_MIRROR: "/virtual-mirror",
  RECOMMENDATION_OUTFIT: "/recommendation-outfit",
  AI_RECOMMENDATION_FASHION: "/ai-recommendation-fashion",
  AI_RECOMMENDATION_COSMETIC: "/ai-recommendation-cosmetic",
  AI_RECOMMENDATION_COSMETIC_RESULT: "/ai-recommendation-cosmetic/result",
  MIRROR_TEMPLATES: "/mirror-templates",
  QRCODE: "/qrcode",
  MAP: "/map",
  SCHEDULE: "/schedule",
  DASHBOARD: "/dashboard",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const ROUTE_RULES = {
  guestOnly: [
    ROUTES.WELCOME,
    ROUTES.QRCODE,
    ROUTES.WAITING_LOGIN,
  ] as string[],
  // logged-out users cannot access these
  protected: [
    ROUTES.LOGGED_IN,
    ROUTES.WAITING_PERSONALIZE,
    ROUTES.AI_RECOMMENDATION_FASHION,
    ROUTES.AI_RECOMMENDATION_COSMETIC,
    ROUTES.AI_RECOMMENDATION_COSMETIC_RESULT,
  ] as string[],
  sequences: {
    // steps must be visited in order; skipping redirects to the first incomplete step
    login: [
      ROUTES.WELCOME,
      ROUTES.QRCODE,
      ROUTES.WAITING_LOGIN,
    ] as string[],
    fit: [
      ROUTES.WAITING_PERSONALIZE,
      ROUTES.AI_RECOMMENDATION_FASHION,
    ] as string[],
  },
} as const;
