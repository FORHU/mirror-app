"use client";

import { Plus } from 'lucide-react';
import type { CalendarEvent } from '../types';
import { EventCard } from './EventCard';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function formatDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return `${DAYS[new Date(y, m-1, day).getDay()]}, ${MONTHS[m-1]} ${day}`;
}

interface Props {
  selectedDate: string;
  events: CalendarEvent[];
  onAddEvent: () => void;
  onViewEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
}

const LOCKED_PREFIXES = ['hardcoded-', 'test-', 'may13-'];

export function CalendarEventList({ selectedDate, events, onAddEvent, onViewEvent, onEditEvent, onDeleteEvent }: Props) {
  const dayEvents = events.filter(e => e.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="px-6 pb-6 pt-6">
      {/* Date heading + Add button */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p style={{ fontWeight: 700, fontSize: 32, color: "#f0eeff", lineHeight: 1.2 }}>{formatDate(selectedDate)}</p>
          <p style={{ fontSize: 15, color: "#4a4870", marginTop: 4 }}>
            {dayEvents.length === 0 ? 'No events scheduled' : `${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={onAddEvent}
          className="flex items-center gap-2 active:scale-95 transition-transform"
          style={{
            background: "#10d49a",
            color: "#0c0b18",
            fontWeight: 700,
            fontSize: 16,
            borderRadius: 999,
            padding: "14px 28px",
            border: "none",
            boxShadow: "0 6px 24px rgba(16,212,154,0.30)",
            cursor: "pointer",
          }}
        >
          <Plus style={{ width: 18, height: 18 }} />
          Add Event
        </button>
      </div>

      {/* YOUR UPCOMING EVENTS label */}
      {dayEvents.length > 0 && (
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#4a4870", marginBottom: 12, textTransform: "uppercase" }}>
          Your upcoming events
        </p>
      )}

      {/* Event cards */}
      <div className="flex flex-col gap-3">
        {dayEvents.length === 0 ? (
          <div className="py-16 text-center">
            <p style={{ fontSize: 20, color: "#2a2848" }}>No events planned</p>
            <p style={{ fontSize: 16, color: "#1e1c35", marginTop: 8 }}>Tap + Add Event to get started</p>
          </div>
        ) : dayEvents.map(event => {
          const locked = LOCKED_PREFIXES.some(p => event.id.startsWith(p));
          return (
            <EventCard key={event.id} event={event}
              onView={onViewEvent}
              onEdit={locked ? undefined : onEditEvent}
              onDelete={locked ? undefined : onDeleteEvent}
            />
          );
        })}
      </div>
    </div>
  );
}
