import type { IntegrationInstance } from '@/lib/types';
import type { NotificationItem, NotificationsSummary } from '@/lib/widgetData/contracts';
import { object, serviceBytes, string, ServiceError, assertStatus } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';

/**
 * ntfy: the last day of messages of the chosen topics, polled
 * (`GET /{topics}/json?poll=1&since=24h`, one JSON message per line), with an
 * access token for protected topics. Keepalive and other events are skipped.
 */
export const MAX_MESSAGES = 50;
const text = (value: unknown, max = 500) => string(value).trim().slice(0, max);
const webLink = (value: unknown) => { const link = text(value, 512); return /^https?:\/\//i.test(link) ? link : undefined; };
export function topicsOf(instance: IntegrationInstance): string[] {
  const topics = (instance.settings.topics ?? '').split(',').map(topic => topic.trim()).filter(Boolean);
  if (!topics.length || topics.length > 20 || topics.some(topic => !/^[-_A-Za-z0-9]{1,64}$/.test(topic))) throw new ServiceError('integrations.ntfy.badTopics', 400);
  return topics;
}
const headers = (instance: IntegrationInstance): Record<string, string> => instance.secrets?.token ? { Authorization: `Bearer ${instance.secrets.token}` } : {};

export function toNtfy(instance: IntegrationInstance, body: string, now = Date.now()): NotificationsSummary {
  const messages: NotificationItem[] = [];
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    let value: Record<string, unknown>;
    try { value = object(JSON.parse(line)); } catch { throw new ServiceError('widgets.error.parse'); }
    if (value.event !== 'message') continue;
    const link = webLink(value.click);
    const priority = typeof value.priority === 'number' && value.priority >= 1 && value.priority <= 5 ? value.priority : 3;
    const tags = Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 5).map(tag => tag.slice(0, 40)) : [];
    messages.push({
      id: text(value.id, 40), source: text(value.topic, 64),
      ...(text(value.title, 200) ? { title: text(value.title, 200) } : {}),
      message: text(value.message), priority, time: typeof value.time === 'number' ? value.time * 1000 : now,
      ...(link ? { link } : {}), ...(tags.length ? { tags } : {}),
    });
  }
  return { provider: 'ntfy', name: instance.name, messages: messages.sort((a, b) => b.time - a.time).slice(0, MAX_MESSAGES), fetchedAt: now };
}

async function poll(instance: IntegrationInstance, since: string) {
  const answer = await serviceBytes(instance, `/${topicsOf(instance).join(',')}/json?poll=1&since=${since}`, { headers: headers(instance) }, 4 * 1024 * 1024);
  assertStatus(answer.status);
  return answer.bytes.toString('utf8');
}

export const ntfyKit: KitServer<NotificationsSummary> = {
  ttlMs: 30_000,
  collect: async instance => toNtfy(instance, await poll(instance, '24h')),
  test: async instance => { toNtfy(instance, await poll(instance, 'latest')); },
  demo: instance => demoNotifications(instance, 'ntfy'),
};

/** Public demo: invented notifications from backups, updates and the UPS. */
export function demoNotifications(instance: IntegrationInstance, provider: 'ntfy' | 'gotify'): NotificationsSummary {
  const now = Date.now(), minute = 60_000;
  const messages: NotificationItem[] = [
    { id: 'd1', source: 'backups', title: 'Backup finished', message: 'Nightly backup of the photo library: 2.4 GB in 6 min.', priority: 3, time: now - 12 * minute, tags: ['white_check_mark'] },
    { id: 'd2', source: 'updates', title: 'Updates available', message: '3 containers have a newer image.', priority: 3, time: now - 95 * minute },
    { id: 'd3', source: 'ups', title: 'On battery', message: 'Power cut for 40 s, back on mains.', priority: 4, time: now - 6 * 60 * minute, tags: ['warning'] },
    { id: 'd4', source: 'backups', title: 'Backup failed', message: 'The offsite copy could not reach the backup box.', priority: 5, time: now - 20 * 60 * minute, tags: ['rotating_light'] },
  ];
  return { provider, name: instance.name, messages, fetchedAt: now };
}
