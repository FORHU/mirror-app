export type FlowState =
  | "IDLE"
  | "AUTH"
  | "AI_FASHION"
  | "AI_COSMETIC"
  | "MAP"
  | "LOCKED";

export function getFlowState(pathname: string): FlowState {
  if (
    pathname === "/" ||
    pathname === "/select-gender" ||
    pathname === "/welcome"
  ) {
    return "AUTH";
  }

  if (pathname.includes("fashion")) return "AI_FASHION";
  if (pathname.includes("cosmetic")) return "AI_COSMETIC";
  if (pathname.startsWith("/map")) return "MAP";

  return "IDLE";
}
