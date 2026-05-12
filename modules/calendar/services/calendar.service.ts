import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '../types';

const STORAGE_KEY = 'mirror_calendar_events';

function load(): CalendarEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function persist(events: CalendarEvent[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export const calendarService = {
  getAll(): CalendarEvent[] {
    return load();
  },

  create(input: CreateEventInput): CalendarEvent {
    const events = load();
    const event: CalendarEvent = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persist([...events, event]);
    return event;
  },

  update(input: UpdateEventInput): CalendarEvent {
    const events = load();
    const idx = events.findIndex(e => e.id === input.id);
    if (idx === -1) throw new Error('Event not found');
    const updated: CalendarEvent = {
      ...events[idx],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    events[idx] = updated;
    persist(events);
    return updated;
  },

  delete(id: string): void {
    persist(load().filter(e => e.id !== id));
  },

  getByDate(date: string): CalendarEvent[] {
    return load().filter(e => e.date === date);
  },
};
