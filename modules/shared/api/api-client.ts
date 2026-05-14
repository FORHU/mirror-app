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
import { useAuthStore } from "@/modules/shared/store/useAuthStore";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

// In-memory token cache to avoid hitting localStorage on every request
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
              headers: { "Content-Type": "application/json", "x-platform": "kiosk" },
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
      useAuthStore.getState()._forceLogout();

      // Dispatch a custom event for the UI to respond to if needed
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("unauthorized"));
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
