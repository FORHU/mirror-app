import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { kioskService } from "@/modules/shared/api/kiosk.service";

/**
 * Ends the current kiosk session: releases the server-side pairing lock
 * AND clears the user's auth tokens. Used by both the manual logout
 * button and the idle-timeout auto-logout so both code paths stay
 * in sync.
 *
 * Failures in either step are logged but don't block the other —
 * we always want the user signed out locally, even if the network
 * call fails.
 */
export async function endKioskSession(): Promise<void> {
  if (typeof window !== "undefined") {
    const kioskId = window.sessionStorage.getItem("kiosk_id");
    if (kioskId) {
      try {
        await kioskService.disconnect(kioskId);
      } catch (e) {
        console.warn("[endKioskSession] kiosk disconnect failed", e);
      }
    }
  }

  await useAuthStore.getState().logout();
}
