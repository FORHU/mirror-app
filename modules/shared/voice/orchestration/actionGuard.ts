import type { ChatWonderAction } from "../../ai/chatwonder.types";
import { getFlowState } from "./flowState";
import { SYSTEM_RESPONSES, ROUTE_RESPONSES } from "../responses";

export type GuardResult = {
  allowed: boolean;
  action: ChatWonderAction | null;
  requiresConfirmation: boolean;
  reply?: string;
};

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

  // AUTH BLOCK
  if (flow === "AUTH") {
    const blocked = [
      "/map",
      "/ai-recommendation-fashion",
      "/ai-recommendation-cosmetic",
    ];

    if (
      action.type === "navigate" &&
      blocked.includes(action.route as string)
    ) {
      return {
        allowed: false,
        action: null,
        requiresConfirmation: false,
        reply: SYSTEM_RESPONSES.genderGuard,
      };
    }
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
