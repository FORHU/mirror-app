import { create } from "zustand";

export interface CalendarEvent {
  id: string;
  title: string;
  eventType: string;
  dateTime: string; // ISO 8601
  location: string;
  createdAt: string; // ISO 8601
}

interface CalendarStore {
  events: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, "id" | "createdAt">) => CalendarEvent;
  removeEvent: (id: string) => void;
  clearEvents: () => void;
}

const STORAGE_KEY = "mirror_calendar_events";

function load(): CalendarEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function save(events: CalendarEvent[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {}
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  events: load(),

  addEvent(event) {
    const newEvent: CalendarEvent = {
      ...event,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    const events = [...get().events, newEvent];
    save(events);
    set({ events });
    return newEvent;
  },

  removeEvent(id) {
    const events = get().events.filter((e) => e.id !== id);
    save(events);
    set({ events });
  },

  clearEvents() {
    save([]);
    set({ events: [] });
  },
}));
