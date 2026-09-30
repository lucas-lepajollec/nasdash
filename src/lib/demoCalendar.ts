import type { LocalCalendarEvent } from './types';

function getDemoReferenceDate(): Date {
  const configuredReference = process.env.NASDASH_DEMO_REFERENCE_TIME?.trim();
  if (!configuredReference) return new Date();

  const parsedReference = new Date(configuredReference);
  return Number.isNaN(parsedReference.getTime()) ? new Date() : parsedReference;
}

/** Fictional events spread over the coming weeks, so the calendar shows a real month. */
const DEMO_EVENTS: Array<{ id: string; title: string; inDays: number; hour: number; minute?: number; minutes: number; allDay?: boolean; description: string }> = [
  { id: 'demo-event-backup', title: 'Sauvegarde hebdomadaire du NAS', inDays: 1, hour: 3, minutes: 60, description: 'Copie des volumes Docker et des photos vers le disque externe.' },
  { id: 'demo-event-maintenance', title: 'Maintenance planifiée du homelab', inDays: 3, hour: 18, minute: 30, minutes: 90, description: 'Événement fictif généré automatiquement pour présenter le calendrier de NasDash.' },
  { id: 'demo-event-proxmox', title: 'Mise à jour de Proxmox VE', inDays: 5, hour: 21, minutes: 45, description: 'Redémarrage d’Orion Compute ; les VM repartent toutes seules.' },
  { id: 'demo-event-certs', title: 'Renouvellement des certificats', inDays: 9, hour: 0, minutes: 0, allDay: true, description: 'Le reverse proxy renouvelle les certificats Let’s Encrypt.' },
  { id: 'demo-event-movie', title: 'Soirée film sur Jellyfin', inDays: 11, hour: 20, minute: 45, minutes: 150, description: 'Le serveur transcode pour quatre écrans en même temps.' },
  { id: 'demo-event-disks', title: 'Contrôle SMART des disques', inDays: 16, hour: 2, minutes: 120, description: 'Test long sur les disques du NAS.' },
];

export function createRollingDemoCalendar(now = getDemoReferenceDate()): LocalCalendarEvent[] {
  return DEMO_EVENTS.map(event => {
    const start = new Date(now);
    start.setDate(start.getDate() + event.inDays);
    start.setHours(event.allDay ? 0 : event.hour, event.allDay ? 0 : event.minute ?? 0, 0, 0);
    const end = new Date(start);
    if (event.allDay) end.setDate(end.getDate() + 1);
    else end.setMinutes(end.getMinutes() + event.minutes);
    return { id: event.id, title: event.title, start: start.toISOString(), end: end.toISOString(), description: event.description, isAllDay: !!event.allDay };
  });
}
