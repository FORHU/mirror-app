import type { ChatWonderAction } from "../../ai/chatwonder.types";

export type GuardResult = {
  allowed: boolean;
  action: ChatWonderAction | null;
  requiresConfirmation: boolean;
  reply?: string;
};

/**
 * Pure schema validation for a ChatWonder action.
 *
 * All business rules have been removed:
 *  - The gender gate is gone — gender is now captured conversationally by the
 *    Stylist persona (just-in-time), not by redirecting to a /select-gender screen.
 *  - The flow-transition confirmation tier is gone — movement between
 *    fashion/cosmetic/map is free; confirmation is server-driven and reserved for
 *    the destructive Restart (see ADR 0001).
 */
export function guardAction(action: ChatWonderAction | null): GuardResult {
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

  return { allowed: true, action, requiresConfirmation: false };
}
