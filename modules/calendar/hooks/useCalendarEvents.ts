"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarService } from '../services/calendar.service';
import type { CreateEventInput, UpdateEventInput } from '../types';

const QK = ['calendar-events'] as const;

export function useCalendarEvents() {
  return useQuery({
    queryKey: QK,
    queryFn: () => calendarService.getAll(),
    staleTime: 30_000,
    retry: 2,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) => calendarService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEventInput) => calendarService.update(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
