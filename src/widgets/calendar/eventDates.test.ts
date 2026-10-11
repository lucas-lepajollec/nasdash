import { afterAll, describe, expect, it } from 'vitest';
import { eventFormDate, eventSchedule, eventStartDate } from './eventDates';

const previousTimezone = process.env.TZ;
afterAll(() => {
  if (previousTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = previousTimezone;
});

describe('calendar event editing dates', () => {
  it.each(['America/Los_Angeles', 'Asia/Tokyo', 'Europe/Paris'])('keeps all-day dates in %s', timezone => {
    process.env.TZ = timezone;
    const event = { id: 'all-day', title: 'Test', start: '2026-10-20T00:00:00.000Z', isAllDay: true };
    expect(eventFormDate(event)).toBe('2026-10-20');
    expect(eventStartDate(event)?.getDate()).toBe(20);
    expect(eventSchedule('2026-10-21', '12:00', true).start).toBe('2026-10-21T00:00:00.000Z');
  });

  it('prefills timed events in local time and preserves their duration when moved', () => {
    process.env.TZ = 'Europe/Paris';
    const original = { id: 'timed', title: 'Meeting', start: '2026-10-20T22:30:00.000Z', end: '2026-10-21T00:00:00.000Z' };
    expect(eventFormDate(original)).toBe('2026-10-21');
    expect(eventSchedule('2026-10-22', '10:00', false, original)).toEqual({
      start: '2026-10-22T08:00:00.000Z', end: '2026-10-22T09:30:00.000Z', isAllDay: false,
    });
  });

  it('keeps a multi-day all-day duration, but gives kind changes a sensible end', () => {
    process.env.TZ = 'UTC';
    const original = { id: 'trip', title: 'Trip', start: '2026-10-20T00:00:00.000Z', end: '2026-10-23T00:00:00.000Z', isAllDay: true };
    expect(eventSchedule('2026-10-24', '12:00', true, original).end).toBe('2026-10-27T00:00:00.000Z');
    expect(eventSchedule('2026-10-24', '12:00', false, original).end).toBe('2026-10-24T13:00:00.000Z');
  });
});
