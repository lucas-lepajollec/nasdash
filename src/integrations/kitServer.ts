/**
 * Server half of the integration kit: what each kit integration reads, how a
 * connection is tested, its fictional demo and its actions. Read by
 * `/api/widgets/kit` and `/api/integrations/test`. Browser code uses `kit.ts`.
 */
import type { IntegrationInstance } from '@/lib/types';
import type { KitSummaryBase } from '@/lib/widgetData/contracts';
import { syncthingKit } from './syncthing/collect';
import { speedtestKit } from './speedtest/collect';
import { wudKit } from './wud/collect';
import { uptimekumaKit } from './uptimekuma/collect';
import { seerrKit } from './seerr/collect';
import { ntfyKit } from './ntfy/collect';
import { audiobookshelfKit } from './audiobookshelf/collect';
import { gotifyKit } from './gotify/collect';
import { kavitaKit } from './kavita/collect';
import { komgaKit } from './komga/collect';
// new:integration imports

export interface KitAction {
  /** `target`: what the action is about (a container id…), checked by the action itself. */
  run(instance: IntegrationInstance, target?: string): Promise<void>;
  /** The public demo: remember the action for the fictional answer, never reach a service. */
  demo?(instance: IntegrationInstance, target?: string): void;
}

export interface KitServer<T extends KitSummaryBase = KitSummaryBase> {
  /** How long one reading is shared by every widget on the same connection. */
  ttlMs: number;
  collect(instance: IntegrationInstance): Promise<T>;
  /** Reads what the widget needs, with the saved credentials: throws a `ServiceError` when it cannot. */
  test(instance: IntegrationInstance): Promise<void>;
  /** Fictional answer for the public demo (documentation addresses and invented names only). */
  demo(instance: IntegrationInstance): T;
  actions?: Record<string, KitAction>;
  /** Changes when the shared reading is out of date (an action finished in the background). */
  revision?(instance: IntegrationInstance): number;
  /**
   * An image the summary named (a cover): only ids the integration listed itself are served, read with the
   * connection's own credentials, so the browser never holds them.
   */
  image?(instance: IntegrationInstance, id: string): Promise<{ bytes: Buffer; contentType: string }>;
  /** Adds what is not cached with the reading (actions in progress), on every answer. */
  decorate?(instance: IntegrationInstance, summary: T): T;
}

const SERVERS: Record<string, KitServer> = {
  syncthing: syncthingKit,
  speedtest: speedtestKit,
  wud: wudKit,
  uptimekuma: uptimekumaKit,
  seerr: seerrKit,
  ntfy: ntfyKit,
  audiobookshelf: audiobookshelfKit,
  gotify: gotifyKit,
  kavita: kavitaKit,
  komga: komgaKit,
  // new:integration servers
};

export function kitServer(type: string): KitServer | undefined {
  return Object.prototype.hasOwnProperty.call(SERVERS, type) ? SERVERS[type] : undefined;
}
