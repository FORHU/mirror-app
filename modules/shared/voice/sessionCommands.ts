import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";
import { outlineService } from "@/modules/shared/api/outline.service";
import { useOutlineStore } from "@/modules/shared/store/useOutlineStore";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { useMapStore } from "@/modules/map/store/useMapStore";
import { useCalendarStore } from "@/modules/shared/store/useCalendarStore";
import { ROUTES, isKnownRoute } from "@/navigation";

/**
 * The three session "R-commands" (see ADR 0001) are driven by the external
 * ChatWonder (Stylist) persona via special `[STYLIST] target_url` values, in the
 * same spirit as the existing `"back"` gesture:
 *
 *   - `"refresh"` → pure page reload, no data change.
 *   - `"restart"` → full "next person" reset (gender + session + Outline), back
 *                   to the landing page. The persona is responsible for the
 *                   spoken confirmation; it only emits this AFTER the user agrees.
 *
 * `"back"` and real routes are also handled here so every `[STYLIST]` consumer
 * shares one code path.
 */

/** Pure page reload — changes no data (Refresh). */
export function performRefresh() {
  if (typeof window !== "undefined") window.location.reload();
}

/**
 * Full reset for the next person at the mirror (Restart): clears gender + the
 * ChatWonder session and wipes the whole Outline (server), resets local stores,
 * and returns to the landing page. VoiceProvider's WELCOME effect then clears the
 * local voice session + chat history on arrival.
 */
export async function performRestart(router: AppRouterInstance) {
  // Server: null gender + new ChatWonder session, and soft-delete the Outline.
  await Promise.allSettled([
    chatWonderService.restart(),
    outlineService.reset(),
  ]);

  // Local: drop gender and any derived UI state.
  try {
    sessionStorage.removeItem("mirror_gender");
  } catch {
    /* sessionStorage may be unavailable */
  }
  const user = useAuthStore.getState().user;
  if (user) useAuthStore.setState({ user: { ...user, gender: undefined } });

  useOutlineStore.getState().reset();
  useMapStore.getState().clearRoute();
  useCalendarStore.getState().clearEvents();
  useMirrorStore.setState({
    aiSuggestion: null,
    pendingGarmentData: null,
    pendingCosmeticsData: null,
    skinAnalysisResult: null,
    skinCaptureUrl: null,
    overviewFashionSnapshot: null,
    overviewCosmeticsSnapshot: null,
    chatNavPending: false,
    chatStreamingText: "",
    chatGarmentData: null,
    chatCosmeticsData: null,
    chatTailorData: null,
    isChatOpen: false,
  });

  router.push(ROUTES.AI_ASSISTANT);
}

/**
 * Per-screen Reset: clears only the current feature's contribution to the active
 * Outline (see ADR 0001). Scope is derived from the current path. Fashion
 * on-screen state isn't cleared here (the persisted rows are); the map route is.
 */
export async function performReset(pathname: string) {
  const scope: "fashion" | "itinerary" | null = pathname.includes("fashion")
    ? "fashion"
    : pathname.startsWith("/map")
      ? "itinerary"
      : null;
  if (!scope) return;
  await outlineService.reset(scope);
  if (scope === "itinerary") useMapStore.getState().clearRoute();
}

/**
 * Single entry point for acting on a `[STYLIST] target_url`. Centralizes the
 * special gestures (`back` / `restart` / `refresh` / `reset`) and real-route
 * navigation so every consumer behaves identically and unknown targets are
 * ignored. `pathname` is needed to scope `reset`.
 */
export async function handleStylistTarget(
  target: string | null | undefined,
  router: AppRouterInstance,
  pathname?: string,
): Promise<void> {
  if (!target) return;
  if (target === "back") {
    router.push(ROUTES.AI_ASSISTANT);
  } else if (target === "restart") {
    await performRestart(router);
  } else if (target === "refresh") {
    performRefresh();
  } else if (target === "reset") {
    if (pathname) await performReset(pathname);
  } else if (isKnownRoute(target)) {
    router.push(target);
  }
  // Unknown targets are intentionally ignored.
}
