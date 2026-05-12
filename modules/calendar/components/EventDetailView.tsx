"use client";

import { ChevronLeft, Clock, MapPin, Tag, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '../types';
import { OCCASION_COLORS } from '../types';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function to12h(t: string) {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
}

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

interface Props {
  event: CalendarEvent;
  isHardcoded?: boolean;
  onBack: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
}

export function EventDetailView({ event, isHardcoded = false, onBack, onEdit, onDelete }: Props) {
  const colors = OCCASION_COLORS[event.occasion];

  return (
    <div className="min-h-full flex flex-col px-6 py-5">
      {/* Back button */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-purple-50 hover:bg-purple-100 transition-colors shrink-0"
        >
          <ChevronLeft className="w-5 h-5 text-[#8b7fc7]" />
        </button>
        <span className="text-lg font-semibold text-gray-400">Event Details</span>
      </div>

      {/* Occasion badge + Title */}
      <div className="mb-5 shrink-0">
        <span className={`text-base font-semibold px-4 py-1.5 rounded-full border ${colors.chipIdle}`}>
          {event.occasion}
        </span>
        <h2 className="text-3xl font-bold text-gray-800 mt-3">{event.title}</h2>
      </div>

      {/* Detail rows */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center gap-4 bg-gray-50 rounded-2xl px-5 py-3.5">
          <Clock className="w-5 h-5 text-[#8b7fc7] shrink-0" />
          <span className="text-lg text-gray-700">{to12h(event.startTime)} – {to12h(event.endTime)}</span>
        </div>

        <div className="flex items-center gap-4 bg-gray-50 rounded-2xl px-5 py-3.5">
          <CalendarDays className="w-5 h-5 text-[#8b7fc7] shrink-0" />
          <span className="text-lg text-gray-700">{fmtDate(event.date)}</span>
        </div>

        {event.location && (
          <div className="flex items-center gap-4 bg-gray-50 rounded-2xl px-5 py-3.5">
            <MapPin className="w-5 h-5 text-[#8b7fc7] shrink-0" />
            <span className="text-lg text-gray-700">{event.location}</span>
          </div>
        )}

        {event.styleHint && (
          <div className="flex items-center gap-4 bg-purple-50 rounded-2xl px-5 py-3.5">
            <Tag className="w-5 h-5 text-[#8b7fc7] shrink-0" />
            <span className="text-lg text-[#8b7fc7]">{event.styleHint}</span>
          </div>
        )}
      </div>

      {/* Edit / Delete — hidden for hardcoded events */}
      {!isHardcoded && (
        <div className="flex gap-3 mt-auto shrink-0">
          <button
            onClick={() => onEdit(event)}
            className="flex-1 flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-[#6b5b95] to-[#8b7fc7] text-white text-lg font-bold rounded-2xl shadow-md shadow-purple-200 active:scale-[0.98] transition-transform"
          >
            <Pencil className="w-5 h-5" />
            Edit
          </button>
          <button
            onClick={() => { onDelete(event.id); onBack(); }}
            className="flex-1 flex items-center justify-center gap-2.5 py-4 bg-red-50 border border-red-200 text-red-500 text-lg font-bold rounded-2xl active:scale-[0.98] transition-transform"
          >
            <Trash2 className="w-5 h-5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
