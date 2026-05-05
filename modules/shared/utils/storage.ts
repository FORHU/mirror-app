/**
 * Storage utilities for the web using localStorage.
 */

export async function getStorageData<T>(key: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return data as unknown as T;
  }
}

export async function setStorageData(
  key: string,
  value: unknown,
): Promise<void> {
  if (typeof window === "undefined") return;
  const data = typeof value === "string" ? value : JSON.stringify(value);
  localStorage.setItem(key, data);
}

export async function removeStorageData(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}
