"use client";

import { useState } from 'react';

export function useCalendarView() {
  const now = new Date();
  const [viewYear,      setViewYear]      = useState(now.getFullYear());
  const [viewMonth,     setViewMonth]     = useState(now.getMonth());
  const [selectedDate,  setSelectedDate]  = useState(now.toISOString().slice(0, 10));

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return { viewYear, viewMonth, selectedDate, setSelectedDate, prevMonth, nextMonth };
}
