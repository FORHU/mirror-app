"use client";

import { ChevronLeft, Clock, MapPin, Tag, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '../types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function to12h(t: string) {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(y, m-1, day);
  return `${DAYS[dt.getDay()]}, ${MONTHS[m-1]} ${day}, ${y}`;
}

const OCCASION_COLORS_DARK: Record<string, string> = {
  Work: '#60a5fa', Casual: '#4ade80', Formal: '#a78bfa', Social: '#f472b6', Sport: '#fb923c',
};

interface Props {
  event: CalendarEvent;
  isHardcoded?: boolean;
  onBack: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
}

export function EventDetailView({ event, isHardcoded = false, onBack, onEdit, onDelete }: Props) {
  const tagColor = OCCASION_COLORS_DARK[event.occasion] ?? '#8a87b0';

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "#1e1c35",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "14px 18px",
  };

  return (
    <div className="min-h-full flex flex-col px-6 py-5 gap-5">
      {/* Back */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 44, height: 44, background: "#1e1c35", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <ChevronLeft style={{ width: 20, height: 20, color: "#8a87b0" }} />
        </button>
        <span style={{ fontSize: 15, color: "#4a4870", fontWeight: 600 }}>Event Details</span>
      </div>

      {/* Occasion + Title */}
      <div>
        <span
          className="inline-block rounded-full px-4 py-1.5 mb-3"
          style={{ fontSize: 13, fontWeight: 600, color: tagColor, background: `${tagColor}18`, border: `1px solid ${tagColor}30` }}
        >
          {event.occasion}
        </span>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: "#f0eeff", lineHeight: 1.2 }}>{event.title}</h2>
      </div>

      {/* Detail rows */}
      <div className="flex flex-col gap-3">
        <div style={rowStyle}>
          <Clock style={{ width: 18, height: 18, color: "#7c6ff7", flexShrink: 0 }} />
          <span style={{ fontSize: 17, color: "#f0eeff" }}>{to12h(event.startTime)} – {to12h(event.endTime)}</span>
        </div>
        <div style={rowStyle}>
          <CalendarDays style={{ width: 18, height: 18, color: "#7c6ff7", flexShrink: 0 }} />
          <span style={{ fontSize: 17, color: "#f0eeff" }}>{fmtDate(event.date)}</span>
        </div>
        {event.location && (
          <div style={rowStyle}>
            <MapPin style={{ width: 18, height: 18, color: "#7c6ff7", flexShrink: 0 }} />
            <span style={{ fontSize: 17, color: "#f0eeff" }}>{event.location}</span>
          </div>
        )}
        {event.styleHint && (
          <div style={{ ...rowStyle, background: "rgba(124,111,247,0.10)", border: "1px solid rgba(124,111,247,0.20)" }}>
            <Tag style={{ width: 18, height: 18, color: "#7c6ff7", flexShrink: 0 }} />
            <span style={{ fontSize: 17, color: "#7c6ff7" }}>{event.styleHint}</span>
          </div>
        )}
      </div>

      {!isHardcoded && (
        <div className="flex gap-3 mt-auto">
          <button
            onClick={() => onEdit(event)}
            className="flex-1 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #7c6ff7, #5c55f0)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 18,
              borderRadius: 14,
              padding: "18px 0",
              border: "none",
              boxShadow: "0 4px 16px rgba(124,111,247,0.30)",
              cursor: "pointer",
            }}
          >
            <Pencil style={{ width: 18, height: 18 }} /> Edit
          </button>
          <button
            onClick={() => { onDelete(event.id); onBack(); }}
            className="flex-1 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform"
            style={{
              background: "rgba(248,113,113,0.10)",
              color: "#f87171",
              fontWeight: 700,
              fontSize: 18,
              borderRadius: 14,
              padding: "18px 0",
              border: "1px solid rgba(248,113,113,0.25)",
              cursor: "pointer",
            }}
          >
            <Trash2 style={{ width: 18, height: 18 }} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
