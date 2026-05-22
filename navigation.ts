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
  VIRTUAL_MIRROR_V2: "/virtual-mirror-v2",
  RECOMMENDATION_OUTFIT: "/recommendation-outfit",
  AI_RECOMMENDATION_OUTFIT: "/ai-recommendation-outfit",
  MIRROR_TEMPLATES: "/mirror-templates",
  QRCODE: "/qrcode",
  QRCODE_MIRROR_A: "/qrcode/mirror-a",
  MAP: "/map",
  SCHEDULE: "/schedule",
  DASHBOARD: "/dashboard",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const ROUTE_RULES = {
  // logged-in users cannot access these
  guestOnly: [
    ROUTES.WELCOME,
    ROUTES.QRCODE_MIRROR_A,
    ROUTES.WAITING_LOGIN,
  ] as string[],
  // logged-out users cannot access these
  protected: [
    ROUTES.LOGGED_IN,
    ROUTES.WAITING_PERSONALIZE,
    ROUTES.VIRTUAL_MIRROR_V2,
    ROUTES.AI_RECOMMENDATION_OUTFIT,
  ] as string[],
  sequences: {
    // steps must be visited in order; skipping redirects to the first incomplete step
    login: [
      ROUTES.WELCOME,
      ROUTES.QRCODE_MIRROR_A,
      ROUTES.WAITING_LOGIN,
    ] as string[],
    fit: [
      ROUTES.WAITING_PERSONALIZE,
      ROUTES.AI_RECOMMENDATION_OUTFIT,
    ] as string[],
  },
} as const;
