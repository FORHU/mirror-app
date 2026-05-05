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
import { User, RegisterRequest } from "@/modules/shared/api/api.types";
import { setCachedAccessToken } from "@/modules/shared/api/api-client";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Internal actions
  _init: () => Promise<void>;
  _forceLogout: () => void;

  // Public actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
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
        set({ user: storedUser, isAuthenticated: true });

        // Try to refresh user data in the background
        try {
          const freshUser = await authService.getCurrentUser();
          await setStorageData(USER, freshUser);
          set({ user: freshUser });
        } catch (e) {
          console.warn("[useAuthStore] Background user refresh failed", e);
        }
      }
    } catch (e) {
      console.error("[useAuthStore] Initialization error", e);
    } finally {
      set({ isLoading: false });
    }
  },

  _forceLogout() {
    set({ user: null, isAuthenticated: false });
  },

  async login(email, password) {
    set({ isLoading: true });
    try {
      const res = await authService.login(email, password);
      await Promise.all([
        setStorageData(ACCESS_TOKEN, res.accessToken),
        setStorageData(REFRESH_TOKEN, res.refreshToken),
        setStorageData(USER, res.user),
      ]);
      setCachedAccessToken(res.accessToken);
      set({ user: res.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  async register(data) {
    set({ isLoading: true });
    try {
      await authService.register(data);
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
