import { create } from "apisauce";
import {
  ACCESS_TOKEN,
  REFRESH_TOKEN,
  USER,
} from "@/modules/shared/constants/storage-keys";
import {
  getStorageData,
  setStorageData,
  removeStorageData,
} from "@/modules/shared/utils/storage";
// In the browser, use relative URLs so requests go through the Next.js proxy
// (next.config.ts rewrites /api/remote/** → backend). This avoids CORS preflight
// failures caused by the x-platform header the backend doesn't whitelist.
const API_BASE_URL =
  typeof window !== "undefined"
    ? ""
    : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

// In-memory token cache to avoid hitting sessionStorage on every request
let _cachedAccessToken: string | null = null;

export function setCachedAccessToken(token: string | null) {
  _cachedAccessToken = token;
}

export const api = create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-platform": "kiosk",
  },
  timeout: 30000,
});

// Request interceptor — attach auth token
api.axiosInstance.interceptors.request.use(async (config) => {
  if (!_cachedAccessToken && typeof window !== "undefined") {
    _cachedAccessToken = await getStorageData<string>(ACCESS_TOKEN);
  }
  if (_cachedAccessToken) {
    config.headers.Authorization = `Bearer ${_cachedAccessToken}`;
  }
  return config;
});

// Response interceptor — handle 401 with token refresh
api.axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const rt = await getStorageData<string>(REFRESH_TOKEN);
      if (rt) {
        try {
          const refreshRes = await fetch(
            `${API_BASE_URL}/api/remote/auth/refresh-token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-platform": "kiosk",
              },
              body: JSON.stringify({ refreshToken: rt }),
            },
          );

          if (refreshRes.ok) {
            const resBody = await refreshRes.json();
            const authData = resBody?.data;
            if (resBody?.status === "success" && authData?.accessToken) {
              await setStorageData(ACCESS_TOKEN, authData.accessToken);
              if (authData.refreshToken) {
                await setStorageData(REFRESH_TOKEN, authData.refreshToken);
              }
              _cachedAccessToken = authData.accessToken;

              originalRequest.headers.Authorization = `Bearer ${authData.accessToken}`;
              return api.axiosInstance(originalRequest);
            }
          }
        } catch (refreshError) {
          console.warn(
            "[api-client] Token refresh network error:",
            refreshError,
          );
        }
      }

      // Both tokens invalid — cleanup and potentially redirect
      console.warn("[api-client] Token refresh failed. Cleaning up session.");
      await removeStorageData(ACCESS_TOKEN);
      await removeStorageData(REFRESH_TOKEN);
      await removeStorageData(USER);
      _cachedAccessToken = null;

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("session_expired"));
      }
    }

    return Promise.reject(error);
  },
);

api.addMonitor((response) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`API Call: ${response.config?.url} [${response.status}]`);
  }
});
