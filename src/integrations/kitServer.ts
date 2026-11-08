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
// new:integration imports

export interface KitAction {
  run(instance: IntegrationInstance): Promise<void>;
  /** The public demo: remember the action for the fictional answer, never reach a service. */
  demo?(instance: IntegrationInstance): void;
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
}

const SERVERS: Record<string, KitServer> = {
  syncthing: syncthingKit,
  speedtest: speedtestKit,
  wud: wudKit,
  // new:integration servers
};

export function kitServer(type: string): KitServer | undefined {
  return Object.prototype.hasOwnProperty.call(SERVERS, type) ? SERVERS[type] : undefined;
}
