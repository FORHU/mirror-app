export type FlowState =
  | "IDLE"
  | "NEEDS_GENDER"
  | "AI_FASHION"
  | "AI_COSMETIC"
  | "MAP"
  | "LOCKED";

export function getFlowState(pathname: string): FlowState {
  if (pathname === "/" || pathname === "/select-gender") {
    return "NEEDS_GENDER";
  }

  if (pathname.includes("fashion")) return "AI_FASHION";
  if (pathname.includes("cosmetic")) return "AI_COSMETIC";
  if (pathname.startsWith("/map")) return "MAP";

  return "IDLE";
}
