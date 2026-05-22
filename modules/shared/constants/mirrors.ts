export const MIRRORS = {
  "mirror-a": { id: "mirror-a", name: "Mirror A" },
  "mirror-b": { id: "mirror-b", name: "Mirror B" },
} as const;

export type MirrorKey = keyof typeof MIRRORS;

// Detect which mirror this browser is.
// Priority: ?mirror= query param (saves to localStorage) → localStorage → env var → "mirror-a"
export function detectMirrorId(): MirrorKey {
  if (typeof window === "undefined") {
    return (process.env.NEXT_PUBLIC_MIRROR_ID as MirrorKey) ?? "mirror-a";
  }
  const param = new URLSearchParams(window.location.search).get(
    "mirror",
  ) as MirrorKey | null;
  if (param && param in MIRRORS) {
    localStorage.setItem("mirror_id", param);
    return param;
  }
  const saved = localStorage.getItem("mirror_id") as MirrorKey | null;
  if (saved && saved in MIRRORS) return saved;
  return (process.env.NEXT_PUBLIC_MIRROR_ID as MirrorKey) ?? "mirror-a";
}
