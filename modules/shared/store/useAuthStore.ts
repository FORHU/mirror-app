import { create } from "zustand";

import {
  ACCESS_TOKEN,
  USER,
} from "@/modules/shared/constants/storage-keys";
import {
  getStorageData,
  setStorageData,
} from "@/modules/shared/utils/storage";
import { authService } from "@/modules/shared/api/auth.service";
import { User } from "@/modules/shared/api/api.types";
import { setCachedAccessToken } from "@/modules/shared/api/api-client";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  _init: () => Promise<void>;
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

      if (!token) return;
      setCachedAccessToken(token);

      if (storedUser) {
        set({ user: storedUser, isAuthenticated: true });
      }

      // Whenever a token is installed (e.g. from installKioskAuth on cold load),
      // fetch the user so isAuthenticated reflects "we have an identity",
      // not "we previously cached one." See ADR 0002.
      try {
        const freshUser = await authService.getCurrentUser();
        await setStorageData(USER, freshUser);
        set({ user: freshUser, isAuthenticated: true });
      } catch (e) {
        setCachedAccessToken(token);
        console.warn("[useAuthStore] User fetch failed", e);
      }
    } catch (e) {
      console.error("[useAuthStore] Initialization error", e);
    } finally {
      set({ isLoading: false });
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
