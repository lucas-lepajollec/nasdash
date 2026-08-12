import type { LocalCalendarEvent } from './types';

const DEMO_EVENT_DELAY_DAYS = 3;

function getDemoReferenceDate(): Date {
  const configuredReference = process.env.NASDASH_DEMO_REFERENCE_TIME?.trim();
  if (!configuredReference) return new Date();

  const parsedReference = new Date(configuredReference);
  return Number.isNaN(parsedReference.getTime()) ? new Date() : parsedReference;
}

export function createRollingDemoCalendar(now = getDemoReferenceDate()): LocalCalendarEvent[] {
  const start = new Date(now);
  start.setDate(start.getDate() + DEMO_EVENT_DELAY_DAYS);
  start.setHours(18, 30, 0, 0);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 90);

  return [{
    id: 'demo-event-maintenance',
    title: 'Maintenance planifiée du homelab',
    start: start.toISOString(),
    end: end.toISOString(),
    description: 'Événement fictif généré automatiquement pour présenter le calendrier de NasDash.',
    isAllDay: false,
  }];
}
