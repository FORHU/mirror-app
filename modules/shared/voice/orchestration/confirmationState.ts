import type { ChatWonderAction } from "../../ai/chatwonder.types";

export type ConfirmationState =
  | { state: "IDLE" }
  | {
      state: "PENDING";
      action: ChatWonderAction;
      reply: string;
      expiresAt: number;
    };

export function createIdleConfirmation(): ConfirmationState {
  return { state: "IDLE" };
}

export function createPendingConfirmation(
  action: ChatWonderAction,
  reply: string,
): ConfirmationState {
  return {
    state: "PENDING",
    action,
    reply,
    expiresAt: Date.now() + 30000,
  };
}

export function isExpired(state: ConfirmationState): boolean {
  return state.state === "PENDING" && Date.now() > state.expiresAt;
}
