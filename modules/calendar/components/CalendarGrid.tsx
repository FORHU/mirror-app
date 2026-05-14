"use client";

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarEvent } from '../types';
import { OCCASION_COLORS } from '../types';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Cell {
  date: string;
  inMonth: boolean;
}

function buildCells(year: number, month: number): Cell[] {
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: Cell[] = [];

  // Tail of previous month
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({
      date: `${py}-${String(pm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      inMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      inMonth: true,
    });
  }

  // Head of next month
  const nm = month === 11 ? 0 : month + 1;
  const ny = month === 11 ? year + 1 : year;
  let d = 1;
  while (cells.length < 42) {
    cells.push({
      date: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      inMonth: false,
    });
    d++;
  }

  return cells;
}

interface Props {
  viewYear: number;
  viewMonth: number;
  selectedDate: string;
  events: CalendarEvent[];
  onSelectDate: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function CalendarGrid({
  viewYear,
  viewMonth,
  selectedDate,
  events,
  onSelectDate,
  onPrev,
  onNext,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const cells = buildCells(viewYear, viewMonth);

  // Group events by date for dot indicators
  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});

  return (
    <div className="px-6 pt-6 pb-2">
      {/* Month / year nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrev}
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-purple-50 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-[#8b7fc7]" />
        </button>
        <h2 className="text-3xl font-bold text-gray-800">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>
        <button
          onClick={onNext}
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-purple-50 transition-colors"
        >
          <ChevronRight className="w-6 h-6 text-[#8b7fc7]" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-lg font-semibold text-gray-400 py-1.5">
            {label}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7">
        {cells.map(({ date, inMonth }) => {
          const dayEvents = eventsByDate[date] ?? [];
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const dayNum = parseInt(date.slice(8), 10);
          const highlight = isToday || isSelected;

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className="flex flex-col items-center py-1 focus:outline-none"
            >
              <span
                className={[
                  'w-14 h-14 flex items-center justify-center rounded-full text-xl font-semibold transition-all',
                  isToday
                    ? 'bg-gradient-to-br from-[#e879f9] to-[#a855f7] text-white font-bold shadow-lg shadow-purple-400/40'
                    : isSelected
                      ? 'border-2 border-[#8b7fc7]/50 text-gray-800'
                      : inMonth
                        ? 'text-gray-800 hover:bg-gray-100'
                        : 'text-gray-300',
                ].join(' ')}
              >
                {dayNum}
              </span>

              {/* Event dots — white on today, colored otherwise */}
              <div className="flex gap-1 mt-1 h-2.5 items-center">
                {dayEvents.slice(0, 3).map(e => (
                  <span
                    key={e.id}
                    className={[
                      'w-2 h-2 rounded-full',
                      isToday ? 'bg-white/80' : OCCASION_COLORS[e.occasion].dot,
                    ].join(' ')}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
