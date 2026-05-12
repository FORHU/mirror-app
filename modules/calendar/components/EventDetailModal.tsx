"use client";

import { Clock, MapPin, Tag, CalendarDays, Pencil } from 'lucide-react';
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

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

interface Props {
  event: CalendarEvent | null;
  isHardcoded?: boolean;
  onClose: () => void;
  onEdit?: (event: CalendarEvent) => void;
}

export function EventDetailModal({ event, isHardcoded = false, onClose, onEdit }: Props) {
  if (!event) return null;

  const colors = OCCASION_COLORS[event.occasion];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full" />
        </div>

        <div className="px-8 pb-10">
          {/* Occasion badge */}
          <div className="flex justify-center mb-5">
            <span className={`text-lg font-semibold px-6 py-2 rounded-full border ${colors.chipIdle}`}>
              {event.occasion}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-4xl font-bold text-gray-800 text-center mb-7">
            {event.title}
          </h2>

          {/* Details */}
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex items-center gap-4 bg-gray-50 rounded-2xl px-6 py-4">
              <Clock className="w-6 h-6 text-[#8b7fc7] shrink-0" />
              <span className="text-xl text-gray-700">
                {to12h(event.startTime)} – {to12h(event.endTime)}
              </span>
            </div>

            <div className="flex items-center gap-4 bg-gray-50 rounded-2xl px-6 py-4">
              <CalendarDays className="w-6 h-6 text-[#8b7fc7] shrink-0" />
              <span className="text-xl text-gray-700">{formatDate(event.date)}</span>
            </div>

            {event.location && (
              <div className="flex items-center gap-4 bg-gray-50 rounded-2xl px-6 py-4">
                <MapPin className="w-6 h-6 text-[#8b7fc7] shrink-0" />
                <span className="text-xl text-gray-700">{event.location}</span>
              </div>
            )}

            {event.styleHint && (
              <div className="flex items-center gap-4 bg-purple-50 rounded-2xl px-6 py-4">
                <Tag className="w-6 h-6 text-[#8b7fc7] shrink-0" />
                <span className="text-xl text-[#8b7fc7]">{event.styleHint}</span>
              </div>
            )}
          </div>

          {/* Edit button (hidden for hardcoded events) */}
          {!isHardcoded && onEdit && (
            <button
              onClick={() => { onEdit(event); onClose(); }}
              className="w-full py-5 flex items-center justify-center gap-3 bg-gradient-to-r from-[#8b7fc7] to-[#f472b6] text-white text-xl font-bold rounded-3xl shadow-lg shadow-purple-200 active:scale-[0.98] transition-transform"
            >
              <Pencil className="w-5 h-5" />
              Edit Event
            </button>
          )}
        </div>
      </div>
    </>
  );
}
