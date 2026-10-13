import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { readConfig } from '@/lib/config';
import { isDemoMode } from '@/lib/demoMode';
import { DEVICE_COLLECTORS, TARGET_LISTERS } from '@/integrations/collectors';
import { getDeviceIntegration } from '@/integrations/registry';
import { MASKED_SECRET, reusesSecretElsewhere } from '@/integrations/instances';
import { isMonitoringType, sourceInput } from '@/integrations/sources';
import { collectorFailure } from '@/integrations/errors';
import { type CollectContext } from '@/integrations/types';
import { isCertificateError } from '@/integrations/http';
import type { IntegrationInstance } from '@/lib/types';

export const dynamic = 'force-dynamic';

const text = (value: unknown, max = 2_048) => (typeof value === 'string' ? value.slice(0, max) : '');

/**
 * Tries a monitoring connection before (or after) it is saved:
 * `POST { type, settings, password?, id?, values? }` → `{ ok, message, targets? }`.
 * Servers that watch several machines (Beszel, Prometheus, Proxmox) answer
 * with the machines they offer, used by the device form's picker. A password
 * left empty or masked uses the one saved for `id`. Admins only; nothing is
 * stored.
 */
export async function POST(request: NextRequest) {
  const authError = checkAdmin(request);
  if (authError) return authError;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: 'integrations.error.invalidRequest' }, { status: 400 });
  }
  const config = readConfig();
  const saved = typeof body.id === 'string' ? config.integrations?.find(instance => instance.id === body.id) : undefined;
  const type = text(body.type, 64) || saved?.type || '';
  const manifest = getDeviceIntegration(type);
  if (!manifest || !isMonitoringType(type)) return NextResponse.json({ ok: false, message: 'integrations.error.unknown' }, { status: 400 });

  if (isDemoMode()) {
    // The public demo never reaches out: it offers fictional machines.
    const targets = type === 'proxmox' ? [{ values: { nodeName: 'orion' }, label: 'orion', detail: 'online' }]
      : type === 'beszel' || type === 'prometheus' ? [{ values: { target: 'demo-node' }, label: 'demo-node' }] : undefined;
    return NextResponse.json({ ok: true, message: 'integrations.test.demo', ...(targets ? { targets } : {}) });
  }

  const draft = body.settings && typeof body.settings === 'object' ? body.settings as Record<string, unknown> : null;
  const password = text(body.password, 8_192);
  const draftSettings = draft ? { ip: text(draft.ip), port: text(draft.port, 16) } : undefined;
  // The saved password only goes to the address it was saved for.
  if (reusesSecretElsewhere(saved, draftSettings, { password })) {
    return NextResponse.json({ ok: false, message: 'integrations.secretRequired' });
  }
  const instance: IntegrationInstance = {
    id: saved?.id ?? 'draft',
    type,
    name: saved?.name ?? manifest.name,
    settings: draft
      ? { ip: text(draft.ip), port: text(draft.port, 16), username: text(draft.username, 256), allowSelfSigned: draft.allowSelfSigned === 'true' ? 'true' : '' }
      : saved?.settings ?? {},
    secrets: { password: password && password !== MASKED_SECRET ? password : saved?.secrets?.password ?? '' },
  };
  const values = body.values && typeof body.values === 'object' ? Object.fromEntries(Object.entries(body.values as Record<string, unknown>).map(([key, value]) => [key, text(value, 256)])) : undefined;
  const input = sourceInput(instance, values);
  const { url, token } = manifest.connect(input);
  const connection = { url, token, vmid: input.vmid, vmType: input.vmType, allowSelfSigned: input.allowSelfSigned === true, target: input.target };
  const context: CollectContext = { memory: {}, warn: () => {}, clearWarning: () => {} };

  try {
    const lister = TARGET_LISTERS[type];
    if (lister && !values) {
      const targets = await lister(connection, context);
      return NextResponse.json({ ok: true, message: targets.length ? 'integrations.test.machines' : 'integrations.test.noMachine', count: targets.length, targets });
    }
    const collect = DEVICE_COLLECTORS[type];
    const result = await collect(connection, context);
    const metrics = Array.isArray(result) ? result : result.metrics;
    return NextResponse.json({ ok: true, message: 'integrations.test.ok', count: metrics.length });
  } catch (error) {
    const failure = collectorFailure(manifest.name, error);
    const certificate = isCertificateError(error);
    const message = certificate ? 'integrations.certificateRejected' : failure.message;
    return NextResponse.json({ ok: false, message, ...(!certificate && failure.parameters ? { messageParameters: failure.parameters } : {}) });
  }
}
