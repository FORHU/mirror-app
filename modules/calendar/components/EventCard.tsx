"use client";

import { Clock, MapPin, Tag, Trash2, Pencil } from 'lucide-react';
import type { CalendarEvent } from '../types';
import { OCCASION_COLORS } from '../types';

function to12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
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

export function EventCard({ event, onView, onEdit, onDelete }: Props) {
  const colors = OCCASION_COLORS[event.occasion];
  const hasActions = onEdit || onDelete;

  return (
    <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Left accent bar */}
      <div className={`w-2 shrink-0 ${colors.accent}`} />

      {/* Main content */}
      <div
        className="flex-1 min-w-0 px-5 py-5 cursor-pointer"
        onClick={() => onView?.(event)}
      >
        {/* Title + occasion badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="font-bold text-gray-800 text-2xl leading-tight">{event.title}</p>
          <span className={`text-base px-4 py-1 rounded-full border shrink-0 font-medium ${colors.chipIdle}`}>
            {event.occasion}
          </span>
        </div>

        {/* Time + location */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2 text-lg text-gray-500">
            <Clock className="w-5 h-5 shrink-0" />
            <span>{to12h(event.startTime)} – {to12h(event.endTime)}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-lg text-gray-500">
              <MapPin className="w-5 h-5 shrink-0" />
              <span className="truncate max-w-[260px]">{event.location}</span>
            </div>
          )}
        </div>

        {/* Style hint */}
        {event.styleHint && (
          <div className="flex items-center gap-2 mt-2.5 text-lg text-[#8b7fc7]">
            <Tag className="w-5 h-5 shrink-0" />
            <span>{event.styleHint}</span>
          </div>
        )}
      </div>

     
    </div>
  );
}
