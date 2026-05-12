"use client";

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { CalendarEvent, CreateEventInput, Occasion } from '../types';
import { OCCASIONS, OCCASION_STYLE_HINTS, OCCASION_COLORS } from '../types';

interface Props {
  isOpen: boolean;
  initialDate: string;
  editEvent?: CalendarEvent | null;
  onClose: () => void;
  onSave: (input: CreateEventInput) => void;
}

export function AddEventModal({ isOpen, initialDate, editEvent, onClose, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [occasion, setOccasion] = useState<Occasion>('Casual');
  const [location, setLocation] = useState('');
  const [titleError, setTitleError] = useState(false);

  // Populate form when editing or reset when opening fresh
  useEffect(() => {
    if (!isOpen) return;
    if (editEvent) {
      setTitle(editEvent.title);
      setDate(editEvent.date);
      setStartTime(editEvent.startTime);
      setEndTime(editEvent.endTime);
      setOccasion(editEvent.occasion);
      setLocation(editEvent.location ?? '');
    } else {
      setTitle('');
      setDate(initialDate);
      setStartTime('09:00');
      setEndTime('10:00');
      setOccasion('Casual');
      setLocation('');
    }
    setTitleError(false);
  }, [isOpen, editEvent, initialDate]);

  if (!isOpen) return null;

  function handleSave() {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    onSave({
      title: title.trim(),
      date,
      startTime,
      endTime,
      occasion,
      styleHint: OCCASION_STYLE_HINTS[occasion],
      location: location.trim() || undefined,
    });
    onClose();
  }

  const inputClass =
    'w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#c084fc]/40 focus:border-[#c084fc]';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Drag handle */}
        <div className="flex justify-center pt-4 pb-2 shrink-0">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-8 pb-10">
          {/* Header */}
          <div className="py-6">
            <h3 className="text-3xl font-bold text-gray-800">
              {editEvent ? 'Edit Event' : 'New Event'}
            </h3>
          </div>

          {/* Title */}
          <input
            type="text"
            placeholder="Event title"
            value={title}
            onChange={e => { setTitle(e.target.value); setTitleError(false); }}
            className={`${inputClass} mb-1 ${titleError ? 'border-red-400 focus:ring-red-300' : ''}`}
          />
          {titleError && (
            <p className="text-base text-red-400 mb-4">Please enter an event title</p>
          )}
          {!titleError && <div className="mb-5" />}

          {/* Date / Start / End row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Date</p>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Start</p>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">End</p>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Occasion chips — equal-width, single row */}
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Occasion</p>
          <div className="flex gap-2 mb-6">
            {OCCASIONS.map(occ => {
              const active = occ === occasion;
              return (
                <button
                  key={occ}
                  onClick={() => setOccasion(occ)}
                  className={[
                    'flex-1 py-3 rounded-2xl text-lg font-medium border transition-all text-center',
                    active
                      ? OCCASION_COLORS[occ].chipActive
                      : OCCASION_COLORS[occ].chipIdle,
                  ].join(' ')}
                >
                  {occ}
                </button>
              );
            })}
          </div>

          {/* Style hint (read-only) */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 mb-6">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Style Hint</p>
            <p className="text-xl text-gray-700">{OCCASION_STYLE_HINTS[occasion]}</p>
          </div>

          {/* Location */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 mb-8 focus-within:ring-2 focus-within:ring-[#c084fc]/40 focus-within:border-[#c084fc] transition-all">
            <MapPin className="w-6 h-6 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Add location (optional)"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="flex-1 bg-transparent text-xl text-gray-700 placeholder-gray-400 focus:outline-none"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full py-6 bg-gradient-to-r from-[#8b7fc7] to-[#f472b6] text-white text-xl font-bold rounded-3xl shadow-lg shadow-purple-200 active:scale-[0.98] transition-transform"
          >
            {editEvent ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </div>
    </>
  );
}
