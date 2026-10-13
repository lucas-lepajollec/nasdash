import { createHash } from 'node:crypto';
import type { CollectContext, ResolvedConnection } from './types';

/** Cached discoveries and sessions are scoped to the complete resolved connection. */
export function scopeConnectionMemory(connection: ResolvedConnection, context: CollectContext) {
  const identity = createHash('sha256').update(JSON.stringify([connection.url, connection.token, connection.target, connection.vmid, connection.vmType, connection.allowSelfSigned])).digest('hex');
  if (context.memory.__connection === identity) return;
  for (const key of Object.keys(context.memory)) delete context.memory[key];
  context.memory.__connection = identity;
}
