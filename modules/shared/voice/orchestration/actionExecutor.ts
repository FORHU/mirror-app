import type { ChatWonderAction } from "../../ai/chatwonder.types";
import { useCalendarStore } from "@/modules/shared/store/useCalendarStore";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { ROUTES } from "@/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export async function executeAction(
  action: ChatWonderAction,
  router: AppRouterInstance,
  onAction?: (action: ChatWonderAction) => void,
) {
  if (!action) return;

  switch (action.type) {
    case "navigate": {
      const { setAiSuggestion, clearAiSuggestion } = useMirrorStore.getState();

      if (action.suggestion) setAiSuggestion(action.suggestion);
      else clearAiSuggestion();

      router.push(action.route ?? ROUTES.AI_ASSISTANT);
      return;
    }

    case "calendar_save_event":
      useCalendarStore.getState().addEvent({
        title: action.title!,
        eventType: action.eventType!,
        dateTime: action.dateTime!,
        location: action.location!,
      });
      return;

    default:
      onAction?.(action);
  }
}
