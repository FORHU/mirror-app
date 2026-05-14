import { api } from '@/modules/shared/api/api-client';
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '../types';

interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export const calendarService = {
  async getAll(): Promise<CalendarEvent[]> {
    const res = await api.get<ApiResponse<CalendarEvent[]>>('/api/v1/events');
    if (res.ok && res.data?.success) return res.data.data;
    throw new Error(res.data?.message ?? 'Failed to fetch events');
  },

  async create(input: CreateEventInput): Promise<CalendarEvent> {
    const res = await api.post<ApiResponse<CalendarEvent>>('/api/v1/events', input);
    if (res.ok && res.data?.success) return res.data.data;
    throw new Error(res.data?.message ?? 'Failed to create event');
  },

  async update({ id, ...data }: UpdateEventInput): Promise<CalendarEvent> {
    const res = await api.put<ApiResponse<CalendarEvent>>(`/api/v1/events/${id}`, data);
    if (res.ok && res.data?.success) return res.data.data;
    throw new Error(res.data?.message ?? 'Failed to update event');
  },

  async delete(id: string): Promise<void> {
    const res = await api.delete<ApiResponse<null>>(`/api/v1/events/${id}`);
    if (!res.ok) throw new Error(res.data?.message ?? 'Failed to delete event');
  },
};
