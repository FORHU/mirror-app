export const MIRRORS = {
  "mirror-a": { id: "mirror-a", name: "Mirror A" },
  "mirror-b": { id: "mirror-b", name: "Mirror B" },
} as const;

export type MirrorKey = keyof typeof MIRRORS;
