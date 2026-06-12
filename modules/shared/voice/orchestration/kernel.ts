import type { ChatWonderAction } from "../../ai/chatwonder.types";
import { guardAction } from "./actionGuard";
import { executeAction } from "./actionExecutor";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export async function runKernel(
  action: ChatWonderAction | null,
  pathname: string,
  router: AppRouterInstance,
  onAction?: (action: ChatWonderAction) => void,
) {
  const guard = guardAction(action);

  if (!guard.allowed) {
    return {
      executed: false,
      reply: guard.reply,
      action: null,
    };
  }

  if (guard.requiresConfirmation && guard.action) {
    return {
      executed: false,
      reply: guard.reply,
      action: guard.action,
      requiresConfirmation: true,
    };
  }

  if (guard.action) {
    await executeAction(guard.action, router, onAction);
  }

  return {
    executed: true,
    reply: guard.reply,
    action: guard.action,
  };
}
