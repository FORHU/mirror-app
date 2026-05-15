"use client";

import { Clock, MapPin, Tag, Trash2, Pencil } from 'lucide-react';
import type { CalendarEvent } from '../types';

function to12h(t: string): string {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
}

interface Props {
  event: CalendarEvent;
  onView?: (event: CalendarEvent) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}

const OCCASION_COLORS_DARK: Record<string, string> = {
  Work:   '#60a5fa',
  Casual: '#4ade80',
  Formal: '#a78bfa',
  Social: '#f472b6',
  Sport:  '#fb923c',
};

export function EventCard({ event, onView, onEdit, onDelete }: Props) {
  const tagColor = OCCASION_COLORS_DARK[event.occasion] ?? '#8a87b0';

  return (
    <div
      className="flex overflow-hidden rounded-2xl cursor-pointer transition-all active:scale-[0.99]"
      style={{
        background: "#1e1c35",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}
      onClick={() => onView?.(event)}
    >
      {/* Left accent bar */}
      <div style={{ width: 3, background: tagColor, flexShrink: 0 }} />

      {/* Content */}
      <div className="flex-1 min-w-0 px-5 py-5">
        {/* Title + badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <p style={{ fontWeight: 700, fontSize: 22, color: "#f0eeff", lineHeight: 1.3 }}>{event.title}</p>
          <span
            className="shrink-0 rounded-full px-3 py-1"
            style={{ fontSize: 13, fontWeight: 600, color: tagColor, background: `${tagColor}18`, border: `1px solid ${tagColor}30` }}
          >
            {event.occasion}
          </span>
        </div>

        {/* Time + location */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-2" style={{ color: "#8a87b0", fontSize: 16 }}>
            <Clock style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{to12h(event.startTime)} – {to12h(event.endTime)}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2" style={{ color: "#8a87b0", fontSize: 16 }}>
              <MapPin style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span className="truncate max-w-[260px]">{event.location}</span>
            </div>
          )}
        </div>

        {/* Style hint */}
        {event.styleHint && (
          <div className="flex items-center gap-2 mt-2.5" style={{ color: "#7c6ff7", fontSize: 15 }}>
            <Tag style={{ width: 15, height: 15, flexShrink: 0 }} />
            <span>{event.styleHint}</span>
          </div>
        )}
      </div>

      {/* Edit / Delete column */}
      {(onEdit || onDelete) && (
        <div className="flex flex-col shrink-0" style={{ width: 72, borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
          {onEdit && (
            <button
              onClick={e => { e.stopPropagation(); onEdit(event); }}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 transition-colors"
              style={{ color: "#7c6ff7", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,111,247,0.12)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Pencil style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>Edit</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(event.id); }}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 transition-colors"
              style={{ color: "#f87171" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.10)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Trash2 style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>Delete</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
