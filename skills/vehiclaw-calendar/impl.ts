// skills/vehiclaw-calendar/impl.ts
// Google Calendar API v3 integration

import { google } from 'googleapis';
import { loadGoogleAuth } from '../../src/auth/google-oauth.js';
import { log } from '../../src/logger.js';
import { config } from '../../src/config.js';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;   // ISO datetime string
  end: string;
  location?: string;
  notes?: string;
  isAllDay: boolean;
}

type TimeRange = 'today' | 'tomorrow' | 'this_week' | 'next_7_days';

function getTimeRange(range: TimeRange, tz: string): { timeMin: string; timeMax: string } {
  const now = new Date();

  // Use the user's timezone offset for local midnight
  const localMidnight = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  let start: Date, end: Date;

  switch (range) {
    case 'today':
      start = localMidnight(now);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      break;

    case 'tomorrow':
      start = localMidnight(now);
      start.setDate(start.getDate() + 1);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      break;

    case 'this_week': {
      start = localMidnight(now);
      end = new Date(start);
      const daysLeft = 7 - now.getDay();
      end.setDate(end.getDate() + daysLeft);
      break;
    }

    case 'next_7_days':
    default:
      start = localMidnight(now);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;
  }

  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

// ── get_calendar_events ────────────────────────────────────────────────────────

export async function getCalendarEvents(params: {
  time_range: TimeRange;
  max_results?: number;
}): Promise<CalendarEvent[]> {
  const auth = await loadGoogleAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const { timeMin, timeMax } = getTimeRange(params.time_range, config.userTimezone);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    maxResults: params.max_results ?? 10,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const items = response.data.items ?? [];

  return items.map(event => {
    const isAllDay = !!event.start?.date;
    return {
      id: event.id ?? '',
      title: event.summary ?? '(No title)',
      start: event.start?.dateTime ?? event.start?.date ?? '',
      end: event.end?.dateTime ?? event.end?.date ?? '',
      location: event.location ?? undefined,
      notes: event.description ?? undefined,
      isAllDay,
    };
  });
}

// ── create_calendar_event ──────────────────────────────────────────────────────

export async function createCalendarEvent(params: {
  title: string;
  date: string;         // YYYY-MM-DD
  time: string;         // HH:MM (24h)
  duration_minutes?: number;
  location?: string;
  notes?: string;
}): Promise<CalendarEvent> {
  const auth = await loadGoogleAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const { title, date, time, duration_minutes = 60, location, notes } = params;

  const startDatetime = new Date(`${date}T${time}:00`);
  const endDatetime = new Date(startDatetime.getTime() + duration_minutes * 60000);

  const timeZone = config.userTimezone;

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: title,
      location,
      description: notes,
      start: { dateTime: startDatetime.toISOString(), timeZone },
      end:   { dateTime: endDatetime.toISOString(),   timeZone },
    },
  });

  const event = response.data;
  log(`Calendar: created "${title}" on ${date} at ${time}`);

  return {
    id: event.id ?? '',
    title: event.summary ?? title,
    start: event.start?.dateTime ?? startDatetime.toISOString(),
    end: event.end?.dateTime ?? endDatetime.toISOString(),
    location: event.location ?? undefined,
    notes: event.description ?? undefined,
    isAllDay: false,
  };
}

export const calendarTools = {
  get_calendar_events: getCalendarEvents,
  create_calendar_event: createCalendarEvent,
};
