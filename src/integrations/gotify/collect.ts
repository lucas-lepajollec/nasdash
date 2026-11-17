import type { IntegrationInstance } from '@/lib/types';
import type { NotificationsSummary } from '@/lib/widgetData/contracts';
import { array, number, object, serviceJson, string, ServiceError } from '@/lib/widgetData/services';
import type { KitServer } from '../kitServer';
import { demoNotifications, MAX_MESSAGES } from '../ntfy/collect';

/**
 * Gotify with a client token (`X-Gotify-Key`): the latest messages
 * (`GET /message?limit=50`) named after their application (`GET /application`).
 * Gotify priorities go from 0 to 10; they are told on ntfy's 1–5 scale.
 */
export const gotifyRequest = <T = unknown>(instance: IntegrationInstance, path: string) =>
  serviceJson<T>(instance, path, { headers: { 'X-Gotify-Key': instance.secrets?.token ?? '' } });
const text = (value: unknown, max = 500) => string(value).trim().slice(0, max);
const webLink = (value: unknown) => { const link = text(value, 512); return /^https?:\/\//i.test(link) ? link : undefined; };
/** 0–1 min, 2–3 low, 4–7 default, 8–9 high, 10 urgent. */
export const priorityOf = (value: number) => value >= 10 ? 5 : value >= 8 ? 4 : value >= 4 ? 3 : value >= 2 ? 2 : 1;

export function toGotify(instance: IntegrationInstance, answer: unknown, applications: unknown, now = Date.now()): NotificationsSummary {
  const list = object(answer).messages;
  if (!Array.isArray(list)) throw new ServiceError('widgets.error.parse');
  const names = new Map(array(applications).map(object).map(app => [number(app.id), text(app.name, 64)]));
  return {
    provider: 'gotify', name: instance.name,
    messages: list.map(object).map(message => {
      const time = Date.parse(string(message.date));
      const link = webLink(object(object(message.extras)['client::notification']).click && object(object(object(message.extras)['client::notification']).click).url);
      return {
        id: String(number(message.id)), source: names.get(number(message.appid)) || `#${number(message.appid)}`,
        ...(text(message.title, 200) ? { title: text(message.title, 200) } : {}),
        message: text(message.message), priority: priorityOf(number(message.priority)), time: Number.isFinite(time) ? time : now,
        ...(link ? { link } : {}),
      };
    }).sort((a, b) => b.time - a.time).slice(0, MAX_MESSAGES),
    fetchedAt: now,
  };
}

export const gotifyKit: KitServer<NotificationsSummary> = {
  ttlMs: 30_000,
  collect: async instance => {
    const [messages, applications] = await Promise.all([gotifyRequest(instance, `/message?limit=${MAX_MESSAGES}`), gotifyRequest(instance, '/application').catch(() => [])]);
    return toGotify(instance, messages, applications);
  },
  test: async instance => { toGotify(instance, await gotifyRequest(instance, '/message?limit=1'), []); },
  demo: instance => demoNotifications(instance, 'gotify'),
};
