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
  {
    id: 'hardcoded-team-standup',
    title: 'Team Stand-up',
    date: TODAY,
    startTime: '09:00',
    endTime: '09:30',
    occasion: 'Work',
    styleHint: 'Business casual or smart formal',
    location: 'Zoom',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'may13-morning-run',
    title: 'Morning Run',
    date: '2026-05-13',
    startTime: '05:30',
    endTime: '06:30',
    occasion: 'Sport',
    styleHint: 'Athletic, performance wear',
    location: 'Rizal Park',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'may13-breakfast-meeting',
    title: 'Breakfast Meeting',
    date: '2026-05-13',
    startTime: '08:00',
    endTime: '09:00',
    occasion: 'Work',
    styleHint: 'Business casual or smart formal',
    location: 'Toby\'s Estate BGC',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'may13-dentist',
    title: 'Dentist Appointment',
    date: '2026-05-13',
    startTime: '10:00',
    endTime: '11:00',
    occasion: 'Casual',
    styleHint: 'Relaxed, comfortable everyday wear',
    location: 'Smile Dental Clinic',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'may13-team-lunch',
    title: 'Team Lunch',
    date: '2026-05-13',
    startTime: '12:00',
    endTime: '13:30',
    occasion: 'Work',
    styleHint: 'Business casual or smart formal',
    location: 'Single Origin, Poblacion',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'may13-client-call',
    title: 'Client Call',
    date: '2026-05-13',
    startTime: '14:00',
    endTime: '15:00',
    occasion: 'Formal',
    styleHint: 'Elegant, sophisticated attire',
    location: 'Google Meet',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'may13-gym',
    title: 'Gym Session',
    date: '2026-05-13',
    startTime: '17:00',
    endTime: '18:30',
    occasion: 'Sport',
    styleHint: 'Athletic, performance wear',
    location: 'Gold\'s Gym Makati',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'may13-dinner',
    title: 'Dinner with Family',
    date: '2026-05-13',
    startTime: '19:00',
    endTime: '21:00',
    occasion: 'Casual',
    styleHint: 'Relaxed, comfortable everyday wear',
    location: 'Manam Comfort Filipino',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'may13-night-walk',
    title: 'Night Walk',
    date: '2026-05-13',
    startTime: '21:30',
    endTime: '22:00',
    occasion: 'Sport',
    styleHint: 'Athletic, performance wear',
    location: 'BGC High Street',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'test-job-interview',
    title: 'Job Interview',
    date: '2026-05-14',
    startTime: '10:00',
    endTime: '11:30',
    occasion: 'Formal',
    styleHint: 'Elegant, sophisticated attire',
    location: 'BGC, Taguig',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'test-gym',
    title: 'Gym Session',
    date: '2026-05-16',
    startTime: '06:00',
    endTime: '07:30',
    occasion: 'Sport',
    styleHint: 'Athletic, performance wear',
    location: 'Anytime Fitness',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'test-dinner',
    title: 'Dinner with Friends',
    date: '2026-05-18',
    startTime: '19:00',
    endTime: '21:00',
    occasion: 'Social',
    styleHint: 'Stylish, trendy outfit',
    location: 'Poblacion, Makati',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'test-date-night',
    title: 'Date Night',
    date: '2026-05-21',
    startTime: '18:30',
    endTime: '22:00',
    occasion: 'Casual',
    styleHint: 'Relaxed, comfortable everyday wear',
    location: 'Eastwood City',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'test-board-meeting',
    title: 'Board Meeting',
    date: '2026-05-22',
    startTime: '09:00',
    endTime: '11:00',
    occasion: 'Work',
    styleHint: 'Business casual or smart formal',
    location: 'One Ayala Tower',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'test-birthday',
    title: 'Birthday Party',
    date: '2026-05-25',
    startTime: '16:00',
    endTime: '20:00',
    occasion: 'Social',
    styleHint: 'Stylish, trendy outfit',
    location: 'Quezon City',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'test-yoga',
    title: 'Yoga Class',
    date: '2026-05-28',
    startTime: '07:00',
    endTime: '08:00',
    occasion: 'Sport',
    styleHint: 'Athletic, performance wear',
    location: 'Pure Yoga BGC',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  },
];

type Screen =
  | { name: 'normal' }
  | { name: 'detail'; event: CalendarEvent }
  | { name: 'add' }
  | { name: 'edit'; event: CalendarEvent };

export default function CalendarPage() {
  const { viewYear, viewMonth, selectedDate, setSelectedDate, prevMonth, nextMonth } =
    useCalendarView();

  const { data: storedEvents = [], isLoading, isError } = useCalendarEvents();
  const allEvents = [...HARDCODED_EVENTS, ...storedEvents];

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [screen, setScreen] = useState<Screen>({ name: 'normal' });
  const [showGoogleNotice, setShowGoogleNotice] = useState(false);

  function handleSave(input: CreateEventInput) {
    if (screen.name === 'edit') {
      updateEvent.mutate({ id: screen.event.id, ...input });
    } else {
      createEvent.mutate(input);
    }
    setScreen({ name: 'normal' });
  }

  function handleDelete(id: string) {
    deleteEvent.mutate(id);
    setScreen({ name: 'normal' });
  }

  // Top card — calendar is ALWAYS visible
  const topCard = (
    <CalendarGrid
      viewYear={viewYear}
      viewMonth={viewMonth}
      selectedDate={selectedDate}
      events={allEvents}
      onSelectDate={date => { setSelectedDate(date); setScreen({ name: 'normal' }); }}
      onPrev={prevMonth}
      onNext={nextMonth}
    />
  );

  // Bottom card — cycles between list / detail / add / edit
  const bottomCard = (() => {
    switch (screen.name) {
      case 'detail':
        return (
          <EventDetailView
            event={screen.event}
            isHardcoded={screen.event.id === 'hardcoded-team-standup'}
            onBack={() => setScreen({ name: 'normal' })}
            onEdit={event => setScreen({ name: 'edit', event })}
            onDelete={handleDelete}
          />
        );
      case 'add':
        return (
          <AddEventView
            initialDate={selectedDate}
            editEvent={null}
            onBack={() => setScreen({ name: 'normal' })}
            onSave={handleSave}
          />
        );
      case 'edit':
        return (
          <AddEventView
            initialDate={selectedDate}
            editEvent={screen.event}
            onBack={() => setScreen({ name: 'detail', event: screen.event })}
            onSave={handleSave}
          />
        );
      default:
        return (
          <CalendarEventList
            selectedDate={selectedDate}
            events={allEvents}
            onAddEvent={() => setScreen({ name: 'add' })}
            onViewEvent={event => setScreen({ name: 'detail', event })}
            onEditEvent={event => setScreen({ name: 'edit', event })}
            onDeleteEvent={handleDelete}
          />
        );
    }
  })();

  return (
    <div className="h-screen bg-gradient-to-br from-[#d8b4fe] via-[#f5d0fe] to-[#fecaca] flex flex-col p-3 gap-3 overflow-hidden">

      {/* Top card — calendar grid */}
      <div className="flex-1 min-h-0 bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg shadow-purple-200/40 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden">
          {topCard}
        </div>

        {/* Google Calendar status bar */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'conic-gradient(#4285f4 90deg, #34a853 90deg 180deg, #fbbc05 180deg 270deg, #ea4335 270deg)' }}>
              <span className="text-white text-[10px] font-bold leading-none">G</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-gray-600">Google Calendar</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span className="text-sm text-red-400">Not connected</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowGoogleNotice(true)}
            className="px-4 py-1.5 rounded-full bg-[#8b7fc7]/10 text-[#8b7fc7] text-sm font-semibold hover:bg-[#8b7fc7]/20 transition-colors"
          >
            Connect
          </button>
        </div>
      </div>

      {/* Bottom card — scrollable, no scrollbar */}
      <div className="flex-1 min-h-0 bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg shadow-purple-200/40 mirror-scroll">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 rounded-full border-4 border-[#8b7fc7]/20 border-t-[#8b7fc7] animate-spin" />
            <p className="text-lg text-gray-400 font-medium">Loading events…</p>
          </div>
        ) : isError ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-xl font-semibold text-gray-500">Could not load events</p>
            <p className="text-base text-gray-400">Check your connection and try again</p>
          </div>
        ) : bottomCard}
      </div>

      {/* Google Calendar notice */}
      {showGoogleNotice && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
            onClick={() => setShowGoogleNotice(false)}
          />
          <div className="fixed inset-x-4 bottom-6 z-50 bg-white rounded-3xl shadow-2xl p-8">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'conic-gradient(#4285f4 90deg, #34a853 90deg 180deg, #fbbc05 180deg 270deg, #ea4335 270deg)' }}>
                <span className="text-white text-xl font-bold leading-none">G</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">Connect Google Calendar</h3>
                <p className="text-lg text-gray-400 mt-0.5">Sync your events automatically</p>
              </div>
            </div>
            <p className="text-xl text-gray-600 leading-relaxed mb-8">
              To connect Google Calendar, you need to{' '}
              <span className="font-semibold text-[#8b7fc7]">sign in using your Google Account</span>.
              {' '}Google login is required to access your calendar and sync events to this mirror.
            </p>
            <button
              onClick={() => setShowGoogleNotice(false)}
              className="w-full py-5 bg-gradient-to-r from-[#8b7fc7] to-[#ffa07a] text-white text-xl font-bold rounded-2xl shadow-md active:scale-[0.98] transition-transform"
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
