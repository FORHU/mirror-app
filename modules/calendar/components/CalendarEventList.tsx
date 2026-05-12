"use client";

import { Plus } from 'lucide-react';
import type { CalendarEvent } from '../types';
import { EventCard } from './EventCard';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatSelectedDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}`;
}

interface Props {
  selectedDate: string;
  events: CalendarEvent[];
  onAddEvent: () => void;
  onViewEvent: (event: CalendarEvent) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
}

export function CalendarEventList({
  selectedDate,
  events,
  onAddEvent,
  onViewEvent,
  onEditEvent,
  onDeleteEvent,
}: Props) {
  const dayEvents = events
    .filter(e => e.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="px-8 pb-8 pt-7">
      {/* Date heading + add button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-bold text-gray-800 text-4xl">{formatSelectedDate(selectedDate)}</p>
          <p className="text-xl text-gray-400 mt-2">
            {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onAddEvent}
          className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#8b7fc7] to-[#ffa07a] text-white text-xl font-semibold rounded-full shadow-lg shadow-purple-300/50 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
          Add Event
        </button>
      </div>

      {/* Event cards */}
      <div className="flex flex-col gap-5">
        {dayEvents.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-300 text-2xl">No events planned</p>
            <p className="text-gray-300 text-xl mt-2">Tap + Add Event to get started</p>
          </div>
        ) : (
          dayEvents.map(event => {
            const isHardcoded = event.id === 'hardcoded-team-standup';
            return (
              <EventCard
                key={event.id}
                event={event}
                onView={onViewEvent}
                onEdit={isHardcoded ? undefined : onEditEvent}
                onDelete={isHardcoded ? undefined : onDeleteEvent}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
