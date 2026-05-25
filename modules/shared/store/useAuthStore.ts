import { create } from "zustand";
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
import { authService } from "@/modules/shared/api/auth.service";
import { User } from "@/modules/shared/api/api.types";
import { setCachedAccessToken } from "@/modules/shared/api/api-client";
import {
  setAuthCookie,
  clearAuthCookie,
} from "@/modules/shared/utils/auth-cookie";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Internal actions
  _init: () => Promise<void>;
  _forceLogout: () => void;

  // Public actions
  login: (email: string, username?: string, kioskId?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  async _init() {
    if (typeof window === "undefined") return;

    try {
      const [storedUser, token] = await Promise.all([
        getStorageData<User>(USER),
        getStorageData<string>(ACCESS_TOKEN),
      ]);

      if (storedUser && token) {
        setCachedAccessToken(token);
        setAuthCookie();
        set({ user: storedUser, isAuthenticated: true });

        // Try to refresh user data in the background.
        // If getCurrentUser() returns 401, the response interceptor will clear
        // _cachedAccessToken. Restore it afterwards so concurrent requests
        // (e.g. outfit creation → try-on) don't lose their auth header.
        try {
          const freshUser = await authService.getCurrentUser();
          await setStorageData(USER, freshUser);
          set({ user: freshUser });
        } catch (e) {
          setCachedAccessToken(token);
          console.warn("[useAuthStore] Background user refresh failed", e);
        }
      } else {
        // No tokens in storage — clear any stale cookie so middleware and
        // client state stay in sync (prevents redirect loops on /logged-in).
        clearAuthCookie();
      }
    } catch (e) {
      console.error("[useAuthStore] Initialization error", e);
    } finally {
      set({ isLoading: false });
    }
  },

  _forceLogout() {
    clearAuthCookie();
    set({ user: null, isAuthenticated: false });
  },

  async login(email, username?, kioskId?) {
    set({ isLoading: true });
    try {
      const res = await authService.login(email, username, kioskId);
      await Promise.all([
        setStorageData(ACCESS_TOKEN, res.accessToken),
        setStorageData(REFRESH_TOKEN, res.refreshToken),
        setStorageData(USER, res.user),
      ]);
      setCachedAccessToken(res.accessToken);
      setAuthCookie();
      set({ user: res.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  async logout() {
    set({ isLoading: true });
    try {
      const rt = await getStorageData<string>(REFRESH_TOKEN);
      if (rt) {
        await authService.logout(rt);
      }
    } catch (e) {
      console.warn("[useAuthStore] Logout API call failed", e);
    } finally {
      await Promise.all([
        removeStorageData(ACCESS_TOKEN),
        removeStorageData(REFRESH_TOKEN),
        removeStorageData(USER),
      ]);
      setCachedAccessToken(null);
      clearAuthCookie();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateUser(data) {
    const currentUser = get().user;
    if (currentUser) {
      const updated = { ...currentUser, ...data };
      set({ user: updated });
      setStorageData(USER, updated);
    }
  },
}));
