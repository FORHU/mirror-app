import { resolveAccessToken } from "./chat-wonder.service";

export interface GenerateOutfitResult {
  success: boolean;
  image_url: string;
  s3_key: string;
  gender: string;
}

export async function generateOutfit(
  blob: Blob,
  gender: "MALE" | "FEMALE",
): Promise<GenerateOutfitResult> {
  const token = await resolveAccessToken();

  const form = new FormData();
  form.append("image", blob, "outfit.png");
  form.append("gender", gender);

  const res = await fetch("/api/mirror/tailor/generate", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<GenerateOutfitResult>;
}
