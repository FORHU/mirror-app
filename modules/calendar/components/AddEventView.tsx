"use client";

import { useEffect, useState } from 'react';
import { ChevronLeft, MapPin } from 'lucide-react';
import type { CalendarEvent, CreateEventInput, Occasion } from '../types';
import { OCCASIONS, OCCASION_STYLE_HINTS } from '../types';

interface Props {
  initialDate: string;
  editEvent?: CalendarEvent | null;
  onBack: () => void;
  onSave: (input: CreateEventInput) => void;
}

const OCCASION_COLORS_DARK: Record<Occasion, string> = {
  Work: '#60a5fa', Casual: '#4ade80', Formal: '#a78bfa', Social: '#f472b6', Sport: '#fb923c',
};

export function AddEventView({ initialDate, editEvent, onBack, onSave }: Props) {
  const [title,     setTitle]     = useState('');
  const [date,      setDate]      = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime,   setEndTime]   = useState('10:00');
  const [occasion,  setOccasion]  = useState<Occasion>('Casual');
  const [location,  setLocation]  = useState('');
  const [titleError,setTitleError]= useState(false);

  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title); setDate(editEvent.date);
      setStartTime(editEvent.startTime); setEndTime(editEvent.endTime);
      setOccasion(editEvent.occasion); setLocation(editEvent.location ?? '');
    } else {
      setTitle(''); setDate(initialDate); setStartTime('09:00');
      setEndTime('10:00'); setOccasion('Casual'); setLocation('');
    }
    setTitleError(false);
  }, [editEvent, initialDate]);

  function handleSave() {
    if (!title.trim()) { setTitleError(true); return; }
    onSave({ title: title.trim(), date, startTime, endTime, occasion, styleHint: OCCASION_STYLE_HINTS[occasion], location: location.trim() || undefined });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#1e1c35",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    padding: "14px 18px",
    fontSize: 18,
    color: "#f0eeff",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.10em",
    textTransform: "uppercase" as const,
    color: "#4a4870",
    display: "block",
    marginBottom: 8,
  };

  return (
    <div className="min-h-full flex flex-col px-6 py-5 gap-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center justify-center rounded-full shrink-0 transition-colors"
          style={{ width: 44, height: 44, background: "#1e1c35", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <ChevronLeft style={{ width: 20, height: 20, color: "#8a87b0" }} />
        </button>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f0eeff" }}>
          {editEvent ? 'Edit ' : 'New '}
          <span style={{ fontStyle: "italic", color: "#7c6ff7" }}>Event</span>
        </h2>
      </div>

      {/* Title */}
      <div>
        <input
          type="text"
          placeholder="Event title"
          value={title}
          onChange={e => { setTitle(e.target.value); setTitleError(false); }}
          style={{ ...inputStyle, borderColor: titleError ? "#f87171" : "rgba(255,255,255,0.10)" }}
          className="placeholder:text-[#4a4870]"
        />
        {titleError && <p style={{ fontSize: 14, color: "#f87171", marginTop: 6 }}>Please enter a title</p>}
      </div>

      {/* Date / Start / End */}
      <div className="grid grid-cols-3 gap-3">
        {([['Date','date',date,setDate],['Start','time',startTime,setStartTime],['End','time',endTime,setEndTime]] as const).map(([lbl, type, val, setter]) => (
          <div key={String(lbl)}>
            <span style={labelStyle}>{String(lbl)}</span>
            <input
              type={String(type)}
              value={String(val)}
              onChange={e => (setter as (v: string) => void)(e.target.value)}
              style={inputStyle}
              className="placeholder:text-[#4a4870]"
            />
          </div>
        ))}
      </div>

      {/* Occasion */}
      <div>
        <span style={labelStyle}>Occasion</span>
        <div className="flex gap-2">
          {OCCASIONS.map(occ => {
            const active = occ === occasion;
            const color = OCCASION_COLORS_DARK[occ];
            return (
              <button
                key={occ}
                onClick={() => setOccasion(occ)}
                className="flex-1 py-3 rounded-xl transition-all text-center"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: active ? "#0c0b18" : color,
                  background: active ? color : `${color}18`,
                  border: `1px solid ${active ? color : `${color}30`}`,
                }}
              >
                {occ}
              </button>
            );
          })}
        </div>
      </div>

      {/* Style hint */}
      <div style={{ background: "rgba(124,111,247,0.10)", border: "1px solid rgba(124,111,247,0.20)", borderRadius: 12, padding: "14px 18px" }}>
        <span style={labelStyle}>Style Hint</span>
        <p style={{ fontSize: 17, color: "#7c6ff7", fontWeight: 500 }}>{OCCASION_STYLE_HINTS[occasion]}</p>
      </div>

      {/* Location */}
      <div
        className="flex items-center gap-3"
        style={{ background: "#1e1c35", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "14px 18px" }}
      >
        <MapPin style={{ width: 20, height: 20, color: "#4a4870", flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Add location (optional)"
          value={location}
          onChange={e => setLocation(e.target.value)}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 18, color: "#f0eeff" }}
          className="placeholder:text-[#4a4870]"
        />
      </div>

      <div className="flex-1" />

      {/* Save button */}
      <button
        onClick={handleSave}
        className="w-full font-bold active:scale-[0.98] transition-transform"
        style={{
          background: "linear-gradient(135deg, #7c6ff7 0%, #5c55f0 100%)",
          color: "#ffffff",
          fontSize: 20,
          borderRadius: 16,
          padding: "20px 0",
          border: "none",
          boxShadow: "0 6px 24px rgba(124,111,247,0.35)",
          cursor: "pointer",
        }}
      >
        {editEvent ? 'Save Changes' : 'Add Event'}
      </button>
    </div>
  );
}
