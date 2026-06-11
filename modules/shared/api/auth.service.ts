import { api } from "./api-client";
import { AuthResponse, User } from "./api.types";
import { StandardResponse } from "./api.types";

export const authService = {
  /**
   * Unified login — email + optional username and kioskId (no password).
   * Matches the companion-app and mirror-api /api/mirror/auth/login contract.
   */
  login: async (
    email: string,
    username?: string,
    kioskId?: string,
  ): Promise<AuthResponse> => {
    const response = await api.post<StandardResponse<AuthResponse>>(
      "/api/mirror/auth/login",
      { email, username, kioskId },
    );
    if (response.ok && response.data?.status === "success") {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Login failed");
  },

  googleLogin: async (
    idToken: string,
    kioskId?: string,
  ): Promise<AuthResponse> => {
    const response = await api.post<StandardResponse<AuthResponse>>(
      "/api/mirror/auth/google",
      { idToken, kioskId },
    );
    if (response.ok && response.data?.status === "success") {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Google authentication failed");
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<StandardResponse<User>>(
      "/api/mirror/users/me",
    );
    if (response.ok && response.data?.status === "success") {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Failed to fetch user");
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post("/api/mirror/auth/logout", { refreshToken });
  },

  refreshAccessToken: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await api.post<StandardResponse<AuthResponse>>(
      "/api/mirror/auth/refresh-token",
      { refreshToken },
    );
    if (response.ok && response.data?.status === "success") {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Refresh token failed");
  },

  updateProfile: async (data: {
    gender: "MALE" | "FEMALE" | null;
  }): Promise<User> => {
    const response = await api.post<StandardResponse<User>>(
      "/api/mirror/auth/update",
      { data },
    );
    if (response.ok && response.data?.status === "success") {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Failed to update profile");
  },
};
