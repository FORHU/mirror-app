import { api } from "./api-client";

export interface UploadedFile {
  fileUrl: string;
  fileId?: string;
  mimeType?: string;
  originalName?: string;
}

export const fileUploadService = {
  upload: async (blob: Blob, filename: string): Promise<UploadedFile> => {
    const form = new FormData();
    form.append("file", blob, filename);
    const res = await api.axiosInstance.post(
      "/api/mirror/file-uploads/upload",
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    const data: UploadedFile = res.data?.data;
    if (!data?.fileUrl) throw new Error("Upload failed — no fileUrl returned");
    return data;
  },
};
