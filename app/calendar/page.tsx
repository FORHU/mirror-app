"use client";

import { useState } from 'react';

import { CalendarGrid } from '@/modules/calendar/components/CalendarGrid';
import { CalendarEventList } from '@/modules/calendar/components/CalendarEventList';
import { AddEventView } from '@/modules/calendar/components/AddEventView';
import { EventDetailView } from '@/modules/calendar/components/EventDetailView';

import { useCalendarView } from '@/modules/calendar/hooks/useCalendarView';
import {
  useCalendarEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from '@/modules/calendar/hooks/useCalendarEvents';
import type { CalendarEvent, CreateEventInput } from '@/modules/calendar/types';

const TODAY = new Date().toISOString().slice(0, 10);

const HARDCODED_EVENTS: CalendarEvent[] = [
  { id: 'hardcoded-team-standup', title: 'Team Stand-up', date: TODAY, startTime: '09:00', endTime: '09:30', occasion: 'Work', styleHint: 'Business casual or smart formal', location: 'Zoom', createdAt: TODAY + 'T00:00:00.000Z', updatedAt: TODAY + 'T00:00:00.000Z' },
  { id: 'test-job-interview',     title: 'Job Interview',         date: '2026-05-14', startTime: '10:00', endTime: '11:30', occasion: 'Formal', styleHint: 'Elegant, sophisticated attire',         location: 'BGC, Taguig',          createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
  { id: 'test-gym',               title: 'Gym Session',           date: '2026-05-16', startTime: '06:00', endTime: '07:30', occasion: 'Sport',  styleHint: 'Athletic, performance wear',           location: 'Anytime Fitness',       createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
  { id: 'test-dinner',            title: 'Dinner with Friends',   date: '2026-05-18', startTime: '19:00', endTime: '21:00', occasion: 'Social', styleHint: 'Stylish, trendy outfit',               location: 'Poblacion, Makati',     createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
  { id: 'test-date-night',        title: 'Date Night',            date: '2026-05-21', startTime: '18:30', endTime: '22:00', occasion: 'Casual', styleHint: 'Relaxed, comfortable everyday wear',   location: 'Eastwood City',         createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
  { id: 'test-board-meeting',     title: 'Board Meeting',         date: '2026-05-22', startTime: '09:00', endTime: '11:00', occasion: 'Work',   styleHint: 'Business casual or smart formal',      location: 'One Ayala Tower',       createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
  { id: 'test-birthday',          title: 'Birthday Party',        date: '2026-05-25', startTime: '16:00', endTime: '20:00', occasion: 'Social', styleHint: 'Stylish, trendy outfit',               location: 'Quezon City',           createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
  { id: 'may13-morning-run',      title: 'Morning Run',           date: '2026-05-13', startTime: '05:30', endTime: '06:30', occasion: 'Sport',  styleHint: 'Athletic, performance wear',           location: 'Rizal Park',            createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
  { id: 'may13-team-lunch',       title: 'Team Lunch',            date: '2026-05-13', startTime: '12:00', endTime: '13:30', occasion: 'Work',   styleHint: 'Business casual or smart formal',      location: 'Single Origin',         createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
  { id: 'may13-dinner',           title: 'Dinner with Family',    date: '2026-05-13', startTime: '19:00', endTime: '21:00', occasion: 'Casual', styleHint: 'Relaxed, comfortable everyday wear',   location: 'Manam Comfort Filipino', createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' },
];

type Screen =
  | { name: 'normal' }
  | { name: 'detail'; event: CalendarEvent }
  | { name: 'add' }
  | { name: 'edit'; event: CalendarEvent };

export default function CalendarPage() {
  const { viewYear, viewMonth, selectedDate, setSelectedDate, prevMonth, nextMonth } = useCalendarView();

  const { data: storedEvents = [], isLoading, isError } = useCalendarEvents();
  const allEvents = [...HARDCODED_EVENTS, ...storedEvents];

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [screen, setScreen] = useState<Screen>({ name: 'normal' });
  const [showGoogleNotice, setShowGoogleNotice] = useState(false);

  function handleSave(input: CreateEventInput) {
    if (screen.name === 'edit') updateEvent.mutate({ id: screen.event.id, ...input });
    else createEvent.mutate(input);
    setScreen({ name: 'normal' });
  }

  function handleDelete(id: string) {
    deleteEvent.mutate(id);
    setScreen({ name: 'normal' });
  }

  const bottomCard = (() => {
    if (isLoading) return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(124,111,247,0.20)", borderTopColor: "#7c6ff7" }} className="animate-spin" />
        <p style={{ fontSize: 16, color: "#4a4870" }}>Loading events…</p>
      </div>
    );
    if (isError) return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
        <p style={{ fontSize: 18, color: "#8a87b0" }}>Could not load events</p>
        <p style={{ fontSize: 14, color: "#4a4870" }}>Check your connection and try again</p>
      </div>
    );
    switch (screen.name) {
      case 'detail': return (
        <EventDetailView
          event={screen.event}
          isHardcoded={['hardcoded-', 'test-', 'may13-'].some(p => screen.event.id.startsWith(p))}
          onBack={() => setScreen({ name: 'normal' })}
          onEdit={event => setScreen({ name: 'edit', event })}
          onDelete={handleDelete}
        />
      );
      case 'add': return (
        <AddEventView initialDate={selectedDate} editEvent={null}
          onBack={() => setScreen({ name: 'normal' })} onSave={handleSave} />
      );
      case 'edit': return (
        <AddEventView initialDate={selectedDate} editEvent={screen.event}
          onBack={() => setScreen({ name: 'detail', event: screen.event })} onSave={handleSave} />
      );
      default: return (
        <CalendarEventList
          selectedDate={selectedDate} events={allEvents}
          onAddEvent={() => setScreen({ name: 'add' })}
          onViewEvent={event => setScreen({ name: 'detail', event })}
          onEditEvent={event => setScreen({ name: 'edit', event })}
          onDeleteEvent={handleDelete}
        />
      );
    }
  })();

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#0c0b18" }}>

      {/* ── Top half: calendar card ── */}
      <div
        className="flex-1 min-h-0 mx-4 mt-4 flex flex-col overflow-hidden"
        style={{ background: "#141230", borderRadius: 24, border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex-1 min-h-0 overflow-hidden">
          <CalendarGrid
            viewYear={viewYear} viewMonth={viewMonth} selectedDate={selectedDate}
            events={allEvents}
            onSelectDate={date => { setSelectedDate(date); setScreen({ name: 'normal' }); }}
            onPrev={prevMonth} onNext={nextMonth}
          />
        </div>

        {/* Google Calendar status bar */}
        <div
          className="shrink-0 flex items-center justify-between px-6 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 26, height: 26, borderRadius: "50%", background: "conic-gradient(#4285f4 90deg, #34a853 90deg 180deg, #fbbc05 180deg 270deg, #ea4335 270deg)" }}
            >
              <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>G</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 14, fontWeight: 600, color: "#8a87b0" }}>Google Calendar</span>
              <div className="flex items-center gap-1.5">
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", display: "inline-block" }} />
                <span style={{ fontSize: 12, color: "#f87171" }}>Not connected</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowGoogleNotice(true)}
            style={{ fontSize: 13, fontWeight: 600, color: "#7c6ff7", background: "rgba(124,111,247,0.12)", border: "1px solid rgba(124,111,247,0.25)", borderRadius: 999, padding: "6px 16px", cursor: "pointer" }}
          >
            Connect
          </button>
        </div>
      </div>

      {/* Gap */}
      <div style={{ height: 12 }} />

      {/* ── Bottom half: event content ── */}
      <div
        className="flex-1 min-h-0 mx-4 mb-4 mirror-scroll"
        style={{ background: "#141230", borderRadius: 24, border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {bottomCard}
      </div>

      {/* Google Calendar notice */}
      {showGoogleNotice && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setShowGoogleNotice(false)} />
          <div
            className="fixed inset-x-4 bottom-6 z-50 p-8"
            style={{ background: "#141230", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
          >
            <div className="flex items-center gap-4 mb-5">
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "conic-gradient(#4285f4 90deg, #34a853 90deg 180deg, #fbbc05 180deg 270deg, #ea4335 270deg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>G</span>
              </div>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: "#f0eeff" }}>Connect Google Calendar</h3>
                <p style={{ fontSize: 15, color: "#4a4870", marginTop: 4 }}>Sync your events automatically</p>
              </div>
            </div>
            <p style={{ fontSize: 18, color: "#8a87b0", lineHeight: 1.6, marginBottom: 28 }}>
              To connect Google Calendar, you need to{" "}
              <span style={{ color: "#7c6ff7", fontWeight: 600 }}>sign in using your Google Account</span>.
              {" "}Google login is required to access your calendar and sync events to this mirror.
            </p>
            <button
              onClick={() => setShowGoogleNotice(false)}
              className="w-full font-bold active:scale-[0.98] transition-transform"
              style={{ background: "linear-gradient(135deg, #7c6ff7, #5c55f0)", color: "#fff", fontSize: 20, borderRadius: 16, padding: "20px 0", border: "none", boxShadow: "0 6px 24px rgba(124,111,247,0.35)", cursor: "pointer" }}
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
