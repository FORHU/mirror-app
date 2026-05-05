import { api } from "./api-client";
import { AuthResponse, RegisterRequest, User } from "./api.types";

export interface StandardResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<StandardResponse<AuthResponse>>(
      "/api/v1/auth/login",
      { email, password },
    );
    if (response.ok && response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Login failed");
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<StandardResponse<AuthResponse>>(
      "/api/v1/auth/register",
      data,
    );
    if (response.ok && response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Registration failed");
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<StandardResponse<User>>("/api/v1/users/me");
    if (response.ok && response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Failed to fetch user");
  },

  logout: async (refreshToken: string): Promise<void> => {
    await api.post("/api/v1/auth/logout", { refreshToken });
  },

  refreshAccessToken: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await api.post<StandardResponse<AuthResponse>>(
      "/api/v1/auth/refresh-token",
      { refreshToken },
    );
    if (response.ok && response.data?.success) {
      return response.data.data;
    }
    throw new Error(response.data?.message || "Refresh token failed");
  },
};
