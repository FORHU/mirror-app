export type VoiceState = "idle" | "recording" | "processing" | "speaking";

export type Route =
  | "/"
  | "/ai-recommendation-fashion"
  | "/ai-recommendation-cosmetic"
  | "/map"
  | "/overview";

export type PendingAction = {
  type: string;
  target: Route;
  createdAt: number;
};

export type Confirmation = "CONFIRM" | "REJECT" | "UNCERTAIN";
export type IntentStrength = "LOW" | "MEDIUM" | "HIGH";
