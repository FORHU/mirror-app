import { api } from "./api-client";

export const kioskService = {
  /**
   * Releases the kiosk's Redis pairing lock so the next user can pair.
   * Safe to call even if the server already considers the kiosk available.
   */
  disconnect: async (kioskId: string): Promise<void> => {
    await api.post("/api/remote/kiosks/disconnect", { kioskId });
  },
};
