export interface EventSetupData {
  eventName: string | null;
  eventType: string | null;
  dateTime: string | null; // ISO 8601 — fed into Calendar
  location: string | null; // human-readable — fed into Maps
}

export interface PageContext {
  route: string;
  pageName: string;
  activeStep?: string;
  collectedData?: EventSetupData;
  mode?: "garment" | "map" | "cosmetics";
  persona?: string;
}

export type PendingEvent = {
  eventName: string;
  eventType: string;
  timeLabel: string;
  missingFields: ("location" | "time")[];
};

export interface ChatWonderInput {
  transcript: string;
  pageContext: PageContext;
}

export type ChatWonderAction =
  | { type: "navigate"; route: string; suggestion?: string }
  | { type: "speak"; text?: string }
  | { type: "page_event"; event: string; payload: Record<string, unknown> }
  | {
      type: "calendar_save_event";
      title: string;
      dateTime: string;
      location: string;
      eventType: string;
    }
  | { type: "calendar_query_date"; date: string }
  | { type: "calendar_clear_event"; id: string }
  | { type: "maps_navigate"; destination: string }
  | {
      type: "maps_get_directions";
      destination: string;
      mode?: "driving" | "walking" | "transit";
    }
  | { type: "maps_preview_location"; query: string; label: string }
  | { type: "maps_show_route"; destination?: string; query?: string }
  | { type: "maps_clear_route" }
  | { type: "stop_navigation" }
  | { type: "maps_camera_overview" }
  | { type: "maps_camera_free" }
  | { type: "traffic_on" }
  | { type: "traffic_off" }
  | {
      type: "set_profile";
      profile: "car" | "motorcycle" | "bicycle" | "walking";
    }
  | {
      type: "maps_suggest_places";
      category:
        | "food"
        | "coffee"
        | "activities"
        | "shopping"
        | "medical"
        | "transit";
      label: string;
    }
  | { type: "GARMENT_RECOMMENDATION"; response: unknown };

export interface ChatWonderResponse {
  intent: string;
  entities: Partial<EventSetupData> & Record<string, string>;
  speech: string;
  action?: ChatWonderAction;
}
