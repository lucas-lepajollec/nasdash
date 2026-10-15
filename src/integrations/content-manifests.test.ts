import { describe, expect, it } from 'vitest';
import { SERVICE_INTEGRATIONS, getServiceIntegration } from './registry';
import { upsertInstance, maskInstanceSecrets, stripInstanceSecrets } from './instances';
import { validateConfigMutationBody } from '@/lib/configEntityValidation';
import type { DashboardConfig } from '@/lib/types';

describe('saved DNS/photo connections', () => {
  it.each(['pihole', 'adguard', 'immich', 'photoprism'])('registers %s, accepts its fields, and keeps secrets out of settings', type => {
    const manifest = getServiceIntegration(type)!;
    expect(SERVICE_INTEGRATIONS).toContain(manifest);
    const settings = Object.fromEntries(manifest.fields.filter(field => field.kind !== 'secret').map(field => [field.id, field.kind === 'toggle' ? 'true' : 'fictional']));
    const secrets = Object.fromEntries(manifest.fields.filter(field => field.kind === 'secret').map(field => [field.id, 'fake-secret']));
    expect(() => validateConfigMutationBody({ integration: { id: `${type}-fictional`, type, settings, secrets } }, 'integration', 'POST')).not.toThrow();
    const secret = manifest.fields.find(field => field.kind === 'secret')!.id;
    expect(() => validateConfigMutationBody({ integration: { type, settings: { [secret]: 'fake-secret' } } }, 'integration', 'POST')).toThrow();
  });
  it('requires a toggle string and rejects arbitrary truthy inputs', () => {
    for (const allowSelfSigned of [true, 1, 'yes']) expect(() => validateConfigMutationBody({ integration: { type: 'pihole', settings: { allowSelfSigned } } }, 'integration', 'POST')).toThrow();
    expect(() => validateConfigMutationBody({ integration: { type: 'pihole', settings: { allowSelfSigned: 'false' } } }, 'integration', 'POST')).not.toThrow();
  });
  it('saves and edits several Pi-holes by explicit ID, with standard secret masking', () => {
    const config: Pick<DashboardConfig, 'integrations'> = { integrations: [] };
    upsertInstance(config, { id: 'pihole-a', type: 'pihole', settings: { url: 'http://first.example.com' }, secrets: { password: 'fake-first' } });
    upsertInstance(config, { id: 'pihole-b', type: 'pihole', settings: { url: 'http://second.example.com' }, secrets: { password: 'fake-second' } });
    upsertInstance(config, { id: 'pihole-b', type: 'pihole', name: 'Second resolver', secrets: { password: '********' } });
    expect(config.integrations).toHaveLength(2);
    expect(config.integrations?.[0].settings.url).toBe('http://first.example.com');
    expect(config.integrations?.[1].secrets?.password).toBe('fake-second');
    maskInstanceSecrets(config);
    expect(config.integrations?.[0].secrets?.password).toBe('********');
    stripInstanceSecrets(config);
    expect(config.integrations?.every(instance => instance.secrets === undefined)).toBe(true);
  });
});
