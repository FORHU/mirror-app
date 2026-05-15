export type Occasion = 'Work' | 'Casual' | 'Formal' | 'Social' | 'Sport';

export const OCCASIONS: Occasion[] = ['Work', 'Casual', 'Formal', 'Social', 'Sport'];

export const OCCASION_STYLE_HINTS: Record<Occasion, string> = {
  Work:   'Business casual or smart formal',
  Casual: 'Relaxed, comfortable everyday wear',
  Formal: 'Elegant, sophisticated attire',
  Social: 'Stylish, trendy outfit',
  Sport:  'Athletic, performance wear',
};

export const OCCASION_COLORS: Record<Occasion, { dot: string; accent: string; chipIdle: string; chipActive: string }> = {
  Work:   { dot: 'bg-blue-400',   accent: 'bg-blue-500',   chipIdle: 'border-gray-200 text-gray-600', chipActive: 'bg-blue-500 border-blue-500 text-white' },
  Casual: { dot: 'bg-green-400',  accent: 'bg-green-500',  chipIdle: 'border-gray-200 text-gray-600', chipActive: 'bg-green-500 border-green-500 text-white' },
  Formal: { dot: 'bg-purple-400', accent: 'bg-purple-500', chipIdle: 'border-gray-200 text-gray-600', chipActive: 'bg-purple-500 border-purple-500 text-white' },
  Social: { dot: 'bg-pink-400',   accent: 'bg-pink-500',   chipIdle: 'border-gray-200 text-gray-600', chipActive: 'bg-pink-500 border-pink-500 text-white' },
  Sport:  { dot: 'bg-orange-400', accent: 'bg-orange-500', chipIdle: 'border-gray-200 text-gray-600', chipActive: 'bg-orange-500 border-orange-500 text-white' },
};

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  occasion: Occasion;
  styleHint: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateEventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEventInput = Partial<CreateEventInput> & { id: string };
