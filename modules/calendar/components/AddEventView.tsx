"use client";

import { useEffect, useState } from 'react';
import { ChevronLeft, MapPin } from 'lucide-react';
import type { CalendarEvent, CreateEventInput, Occasion } from '../types';
import { OCCASIONS, OCCASION_STYLE_HINTS, OCCASION_COLORS } from '../types';

interface Props {
  initialDate: string;
  editEvent?: CalendarEvent | null;
  onBack: () => void;
  onSave: (input: CreateEventInput) => void;
}

export function AddEventView({ initialDate, editEvent, onBack, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [occasion, setOccasion] = useState<Occasion>('Casual');
  const [location, setLocation] = useState('');
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
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
  }, [editEvent, initialDate]);

  function handleSave() {
    if (!title.trim()) { setTitleError(true); return; }
    onSave({
      title: title.trim(),
      date,
      startTime,
      endTime,
      occasion,
      styleHint: OCCASION_STYLE_HINTS[occasion],
      location: location.trim() || undefined,
    });
  }

  const inputBase =
    'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8b7fc7]/40 focus:border-[#8b7fc7] transition-all';

  const label = 'text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2 block';

  return (
    <div className="min-h-full flex flex-col px-6 py-5 gap-4">

      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-purple-50 hover:bg-purple-100 transition-colors shrink-0"
        >
          <ChevronLeft className="w-6 h-6 text-[#8b7fc7]" />
        </button>
        <h2 className="text-3xl font-bold text-gray-800">
          {editEvent ? 'Edit Event' : 'New Event'}
        </h2>
      </div>

      {/* Event title */}
      <div>
        <input
          type="text"
          placeholder="Event title"
          value={title}
          onChange={e => { setTitle(e.target.value); setTitleError(false); }}
          className={`${inputBase} ${titleError ? 'border-red-400 focus:ring-red-300' : ''}`}
        />
        {titleError && (
          <p className="text-base text-red-400 mt-1.5">Please enter an event title</p>
        )}
      </div>

      {/* Date / Start / End */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <span className={label}>Date</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputBase} />
        </div>
        <div>
          <span className={label}>Start</span>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputBase} />
        </div>
        <div>
          <span className={label}>End</span>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputBase} />
        </div>
      </div>

      {/* Occasion — single row, equal width chips */}
      <div>
        <span className={label}>Occasion</span>
        <div className="flex gap-2">
          {OCCASIONS.map(occ => (
            <button
              key={occ}
              onClick={() => setOccasion(occ)}
              className={[
                'flex-1 py-3 rounded-xl text-lg font-semibold border transition-all text-center',
                occ === occasion ? OCCASION_COLORS[occ].chipActive : OCCASION_COLORS[occ].chipIdle,
              ].join(' ')}
            >
              {occ}
            </button>
          ))}
        </div>
      </div>

      {/* Style hint */}
      <div className="bg-purple-50 border border-purple-100 rounded-xl px-5 py-4">
        <span className={label}>Style Hint</span>
        <p className="text-xl text-[#8b7fc7] font-medium">{OCCASION_STYLE_HINTS[occasion]}</p>
      </div>

      {/* Location */}
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 focus-within:ring-2 focus-within:ring-[#8b7fc7]/40 focus-within:border-[#8b7fc7] transition-all">
        <MapPin className="w-6 h-6 text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Add location (optional)"
          value={location}
          onChange={e => setLocation(e.target.value)}
          className="flex-1 bg-transparent text-xl text-gray-700 placeholder-gray-400 focus:outline-none"
        />
      </div>

      {/* Spacer — pushes save button to bottom */}
      <div className="flex-1" />

      {/* Save button */}
      <button
        onClick={handleSave}
        className="w-full py-5 bg-gradient-to-r from-[#8b7fc7] to-[#ffa07a] text-white text-2xl font-bold rounded-2xl shadow-md shadow-purple-200 active:scale-[0.98] transition-transform"
      >
        {editEvent ? 'Save Changes' : 'Add Event'}
      </button>

    </div>
  );
}
