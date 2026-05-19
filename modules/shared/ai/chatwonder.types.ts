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
  | { type: "speak";                 text: string }
  | { type: "page_event";            event: string; payload: Record<string, unknown> }
  | { type: "calendar_save_event";   title: string; dateTime: string; location: string; eventType: string }
  | { type: "maps_preview_location"; query: string; label: string }
  | { type: "maps_get_directions";   destination: string };

export interface ChatWonderResponse {
  intent:   string;
  entities: Partial<EventSetupData> & Record<string, string>;
  speech:   string;
  action?:  ChatWonderAction;
}
