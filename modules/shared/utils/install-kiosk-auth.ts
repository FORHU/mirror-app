import {
  ACCESS_TOKEN,
  REFRESH_TOKEN,
} from "@/modules/shared/constants/storage-keys";
import { setStorageData, getStorageData } from "@/modules/shared/utils/storage";
import { setCachedAccessToken } from "@/modules/shared/api/api-client";

function getKioskTokens(): { access: string; refresh: string } {
  const isKiosk2 =
    typeof window !== "undefined" &&
    window.location.hostname === process.env.NEXT_PUBLIC_DOMAIN2;
  return isKiosk2
    ? {
        access: process.env.NEXT_PUBLIC_USER2_ACCESS_TOKEN ?? "",
        refresh: process.env.NEXT_PUBLIC_USER2_REFRESH_TOKEN ?? "",
      }
    : {
        access: process.env.NEXT_PUBLIC_USER1_ACCESS_TOKEN ?? "",
        refresh: process.env.NEXT_PUBLIC_USER1_REFRESH_TOKEN ?? "",
      };
}

/**
 * Installs the kiosk's identity (per-hostname JWT) into storage + in-memory
 * cache so the api-client can authenticate requests. Idempotent — skips work
 * when the cached access token already matches.
 */
export async function installKioskAuth(): Promise<void> {
  if (typeof window === "undefined") return;

  const { access, refresh } = getKioskTokens();
  if (!access) return;

  const existing = await getStorageData<string>(ACCESS_TOKEN);
  if (existing === access) return;

  setCachedAccessToken(access);
  await setStorageData(ACCESS_TOKEN, access);
  if (refresh) await setStorageData(REFRESH_TOKEN, refresh);
}
