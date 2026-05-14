import { api } from "./api-client";

export const tryOnModelService = {
  uploadModel: async (dataUrl: string): Promise<void> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const form = new FormData();
    form.append("file", blob, "model.jpg");

    await api.axiosInstance.post("/mirror/try-on/model", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
