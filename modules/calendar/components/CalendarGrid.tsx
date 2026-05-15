"use client";

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarEvent } from '../types';
import { OCCASION_COLORS } from '../types';

const DAY_LABELS  = ['S','M','T','W','T','F','S'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function buildCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const daysInPrev   = new Date(year, month, 0).getDate();
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ date: `${py}-${String(pm+1).padStart(2,'0')}-${String(daysInPrev-i).padStart(2,'0')}`, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, inMonth: true });
  const nm = month === 11 ? 0 : month + 1;
  const ny = month === 11 ? year + 1 : year;
  let d = 1;
  while (cells.length < 42)
    cells.push({ date: `${ny}-${String(nm+1).padStart(2,'0')}-${String(d++).padStart(2,'0')}`, inMonth: false });
  return cells;
}

interface Props {
  viewYear: number; viewMonth: number; selectedDate: string;
  events: CalendarEvent[];
  onSelectDate: (date: string) => void;
  onPrev: () => void; onNext: () => void;
}

export function CalendarGrid({ viewYear, viewMonth, selectedDate, events, onSelectDate, onPrev, onNext }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const cells = buildCells(viewYear, viewMonth);
  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e); return acc;
  }, {});

  return (
    <div className="px-6 pt-6 pb-3">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onPrev}
          className="w-11 h-11 flex items-center justify-center rounded-full transition-colors"
          style={{ background: "#1e1c35", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: "#8a87b0" }} />
        </button>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: "#f0eeff" }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>
        <button
          onClick={onNext}
          className="w-11 h-11 flex items-center justify-center rounded-full transition-colors"
          style={{ background: "#1e1c35", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <ChevronRight className="w-5 h-5" style={{ color: "#8a87b0" }} />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="text-center py-1.5" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.06em", color: "#4a4870" }}>{l}</div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7">
        {cells.map(({ date, inMonth }) => {
          const dayEvents = eventsByDate[date] ?? [];
          const isToday    = date === today;
          const isSelected = date === selectedDate;
          const dayNum     = parseInt(date.slice(8), 10);

          const circleStyle: React.CSSProperties = isToday
            ? { background: "#10d49a", boxShadow: "0 4px 16px rgba(16,212,154,0.35)" }
            : isSelected
              ? { background: "#7c6ff7", boxShadow: "0 4px 16px rgba(124,111,247,0.35)" }
              : {};

          const textColor = (isToday || isSelected)
            ? "#ffffff"
            : inMonth ? "#f0eeff" : "#2a2848";

          return (
            <button key={date} onClick={() => onSelectDate(date)} className="flex flex-col items-center py-1.5 focus:outline-none">
              <span
                className="w-12 h-12 flex items-center justify-center rounded-full transition-all"
                style={{ fontSize: 18, fontWeight: 600, color: textColor, ...circleStyle }}
              >
                {dayNum}
              </span>
              <div className="flex gap-1 mt-1 h-2.5 items-center">
                {dayEvents.slice(0, 3).map(e => (
                  <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${(isToday || isSelected) ? 'bg-white/60' : OCCASION_COLORS[e.occasion].dot}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
