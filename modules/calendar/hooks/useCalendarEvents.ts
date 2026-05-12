"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarService } from '../services/calendar.service';
import type { CreateEventInput, UpdateEventInput } from '../types';

const QK = ['calendar-events'] as const;

export function useCalendarEvents() {
  return useQuery({
    queryKey: QK,
    queryFn: calendarService.getAll.bind(calendarService),
    staleTime: 0,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) =>
      Promise.resolve(calendarService.create(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEventInput) =>
      Promise.resolve(calendarService.update(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      Promise.resolve(calendarService.delete(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
