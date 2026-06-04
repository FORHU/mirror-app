import type { ChatWonderAction } from "../../ai/chatwonder.types";
import { getFlowState } from "./flowState";
import { useAuthStore } from "../../store/useAuthStore";
import { SYSTEM_RESPONSES, ROUTE_RESPONSES } from "../responses";

export type GuardResult = {
  allowed: boolean;
  action: ChatWonderAction | null;
  requiresConfirmation: boolean;
  reply?: string;
};

const GENDER_GATED_ROUTES = [
  "/ai-recommendation-fashion",
  "/ai-recommendation-cosmetic",
  "/map",
];

function hasGender(): boolean {
  const fromStore = useAuthStore.getState().user?.gender;
  if (fromStore) return true;
  if (typeof window === "undefined") return false;
  return Boolean(sessionStorage.getItem("mirror_gender"));
}

export function guardAction(
  action: ChatWonderAction | null,
  pathname: string,
): GuardResult {
  const flow = getFlowState(pathname);

  if (!action) {
    return { allowed: false, action: null, requiresConfirmation: false };
  }

  if (!action.type) {
    return {
      allowed: false,
      action: null,
      requiresConfirmation: false,
      reply: "Invalid action.",
    };
  }

  if (action.type === "navigate" && !action.route) {
    return {
      allowed: false,
      action: null,
      requiresConfirmation: false,
      reply: "Missing route.",
    };
  }

  // Gender gate — fashion/cosmetics require gender, regardless of which route
  // the user is currently on. If gender is missing, redirect to /select-gender
  // so the user can complete the gate.
  if (
    action.type === "navigate" &&
    GENDER_GATED_ROUTES.includes(action.route as string) &&
    !hasGender()
  ) {
    return {
      allowed: true,
      action: {
        type: "navigate",
        route: `/select-gender?next=${encodeURIComponent(action.route)}`,
      } as ChatWonderAction,
      requiresConfirmation: false,
      reply: SYSTEM_RESPONSES.genderGuard,
    };
  }

  // CONFIRMATION RULES ONLY (NO STATE STORAGE HERE)
  if (
    flow === "AI_FASHION" &&
    action.type === "navigate" &&
    action.route === "/map"
  ) {
    return {
      allowed: true,
      action,
      requiresConfirmation: true,
      reply: ROUTE_RESPONSES["/map"].intercept,
    };
  }

  if (
    flow === "AI_COSMETIC" &&
    action.type === "navigate" &&
    action.route === "/map"
  ) {
    return {
      allowed: true,
      action,
      requiresConfirmation: true,
      reply: ROUTE_RESPONSES["/map"].intercept,
    };
  }

  return {
    allowed: true,
    action,
    requiresConfirmation: false,
  };
}
