export const STOP_COLORS = [
  "#FBBF24", // yellow
  "#3B82F6", // blue
  "#EF4444", // red
  "#22C55E", // green
  "#F97316", // orange
  "#A855F7", // purple
];

export function stopColor(index: number): string {
  return STOP_COLORS[index % STOP_COLORS.length];
}
