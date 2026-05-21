export interface EventSetupData {
  eventName:  string | null;
  eventType:  string | null;
  dateTime:   string | null; // ISO 8601 — fed into Calendar
  location:   string | null; // human-readable — fed into Maps
}

export interface PageContext {
  route:          string;
  pageName:       string;
  activeStep?:    string;
  collectedData?: EventSetupData;
}

export interface ChatWonderInput {
  transcript:  string;
  pageContext: PageContext;
}

export type ChatWonderAction =
  | { type: "navigate";              route: string }
  | { type: "speak";                 text?: string }
  | { type: "page_event";            event: string; payload: Record<string, unknown> }
  | { type: "calendar_save_event";   title: string; dateTime: string; location: string; eventType: string }
  | { type: "calendar_query_date";   date: string }
  | { type: "calendar_clear_event";  id: string }
  | { type: "maps_navigate";         destination: string }
  | { type: "maps_preview_location"; query: string; label: string }
  | { type: "maps_get_directions";   destination: string; mode?: "driving" | "walking" | "transit" }
  | { type: "maps_clear" }
  | { type: "traffic_on" }
  | { type: "traffic_off" }
  | { type: "traffic_route" }
  | { type: "stop_navigation" }
  | { type: "set_profile";           profile: "car" | "motorcycle" | "bicycle" | "walking" };

export interface ChatWonderResponse {
  intent:   string;
  entities: Partial<EventSetupData> & Record<string, string>;
  speech:   string;
  action?:  ChatWonderAction;
}
