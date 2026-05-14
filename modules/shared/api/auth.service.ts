import { api } from "./api-client";
import { AuthResponse, User } from "./api.types";
import { StandardResponse } from "./api.types";

export const authService = {
  /**
   * Unified login — email + optional username and kioskId (no password).
   * Matches the companion-app and mirror-api /api/remote/auth/login contract.
   */
  login: async (email: string, username?: string, kioskId?: string): Promise<AuthResponse> => {
    const response = await api.post<StandardResponse<AuthResponse>>(
      "/api/remote/auth/login",
      { email, username, kioskId },
    );
    if (response.ok && response.data?.status === "success") {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Login failed");
  },

  googleLogin: async (idToken: string, kioskId?: string): Promise<AuthResponse> => {
    const response = await api.post<StandardResponse<AuthResponse>>(
      "/api/remote/auth/google",
      { idToken, kioskId },
    );
    if (response.ok && response.data?.status === "success") {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Google authentication failed");
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<StandardResponse<User>>("/api/remote/users/me");
    if (response.ok && response.data?.status === "success") {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Failed to fetch user");
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post("/api/remote/auth/logout", { refreshToken });
  },

  refreshAccessToken: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await api.post<StandardResponse<AuthResponse>>(
      "/api/remote/auth/refresh-token",
      { refreshToken },
    );
    if (response.ok && response.data?.status === "success") {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Refresh token failed");
  },
};
