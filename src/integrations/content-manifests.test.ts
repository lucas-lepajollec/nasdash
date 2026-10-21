import { describe, expect, it } from 'vitest';
import { SERVICE_INTEGRATIONS, getServiceIntegration } from './registry';
import { upsertInstance, maskInstanceSecrets, stripInstanceSecrets } from './instances';
import { validateConfigMutationBody } from '@/lib/configEntityValidation';
import { MEDIA_SERVER_TYPES, ARR_TYPES, DOWNLOAD_CLIENT_TYPES } from '@/lib/widgetData/contracts';
import type { DashboardConfig } from '@/lib/types';

describe('saved content service connections', () => {
  it.each(['pihole', 'adguard', 'technitium', 'immich', 'photoprism', 'piwigo', 'librephotos', 'customapi', 'jellyfin', 'emby', 'plex', 'navidrome', ...ARR_TYPES, ...DOWNLOAD_CLIENT_TYPES])('registers %s, accepts its fields, and keeps secrets out of settings', type => {
    const manifest = getServiceIntegration(type)!;
    expect(SERVICE_INTEGRATIONS).toContain(manifest);
    const settings = Object.fromEntries(manifest.fields.filter(field => field.kind !== 'secret').map(field => [field.id, field.kind === 'toggle' ? 'true' : field.kind === 'select' ? field.options![0].value : 'fictional']));
    const secrets = Object.fromEntries(manifest.fields.filter(field => field.kind === 'secret').map(field => [field.id, 'fake-secret']));
    expect(() => validateConfigMutationBody({ integration: { id: `${type}-fictional`, type, settings, secrets } }, 'integration', 'POST')).not.toThrow();
    const secret = manifest.fields.find(field => field.kind === 'secret')!.id;
    expect(() => validateConfigMutationBody({ integration: { type, settings: { [secret]: 'fake-secret' } } }, 'integration', 'POST')).toThrow();
  });
  it('requires a toggle string and rejects arbitrary truthy inputs', () => {
    for (const allowSelfSigned of [true, 1, 'yes']) expect(() => validateConfigMutationBody({ integration: { type: 'pihole', settings: { allowSelfSigned } } }, 'integration', 'POST')).toThrow();
    expect(() => validateConfigMutationBody({ integration: { type: 'pihole', settings: { allowSelfSigned: 'false' } } }, 'integration', 'POST')).not.toThrow();
  });
  it('accepts every select option and empty values, rejecting other inputs', () => {
    for (const authType of ['', 'none', 'bearer', 'header', 'basic', 'query']) {
      expect(() => validateConfigMutationBody({ integration: { type: 'customapi', settings: { authType } } }, 'integration', 'POST')).not.toThrow();
    }
    for (const authType of ['invalid', true, 1]) {
      expect(() => validateConfigMutationBody({ integration: { type: 'customapi', settings: { authType } } }, 'integration', 'POST')).toThrow();
    }
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

it.each(MEDIA_SERVER_TYPES)('describes the exact %s media connection fields', type => {
  const manifest = getServiceIntegration(type)!;
  const secret = type === 'plex' ? 'token' : 'apiKey';
  expect(manifest.name).toBe(type === 'jellyfin' ? 'Jellyfin' : type === 'emby' ? 'Emby' : 'Plex');
  expect(manifest.fields).toEqual([
    { id: 'url', kind: 'text', required: true, label: `integrations.${type}.url`, placeholder: `http://${type}.example.com:${type === 'plex' ? 32400 : 8096}` },
    { id: secret, kind: 'secret', required: true, label: `integrations.${type}.${secret}` },
    { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' },
  ]);
});


it.each([...ARR_TYPES, ...DOWNLOAD_CLIENT_TYPES])('describes the exact %s credentials and URL', type => {
  const manifest = getServiceIntegration(type)!;
  const ports = { sonarr: 8989, radarr: 7878, lidarr: 8686, prowlarr: 9696, qbittorrent: 8080, transmission: 9091, deluge: 8112, sabnzbd: 8080, nzbget: 6789 };
  expect(manifest.fields[0]).toEqual({ id: 'url', kind: 'text', required: true, label: `integrations.${type}.url`, placeholder: `http://${type}.example.com:${ports[type]}` });
  const secret = (ARR_TYPES as readonly string[]).includes(type) || type === 'sabnzbd' ? 'apiKey' : 'password';
  // qBittorrent shows its password or its API key depending on the chosen sign-in.
  const login = type === 'qbittorrent' ? { showWhen: { field: 'auth', values: ['', 'login'] } } : {};
  expect(manifest.fields.find(field => field.id === secret)).toEqual({ id: secret, kind: 'secret', label: `integrations.${type}.${secret}`, ...(type !== 'transmission' ? { required: true } : {}), ...login });
  if (type === 'qbittorrent') expect(manifest.fields.find(field => field.id === 'apiKey')).toEqual({ id: 'apiKey', kind: 'secret', label: 'integrations.qbittorrent.apiKey', required: true, showWhen: { field: 'auth', values: ['apikey'] } });
  expect(manifest.fields.at(-1)).toEqual({ id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned' });
  expect(manifest.fields.some(field => field.id === 'username')).toBe(['qbittorrent', 'transmission', 'nzbget'].includes(type));
});

it('registers Subsonic accounts in media with a write-only password', () => {
  const manifest = getServiceIntegration('navidrome')!;
  expect(manifest.section).toBe('media');
  expect(manifest.fields.map(({ id, kind, required }) => ({ id, kind, required }))).toEqual([
    {id:'url',kind:'text',required:true}, {id:'username',kind:'text',required:true}, {id:'password',kind:'secret',required:true}, {id:'allowSelfSigned',kind:'toggle',required:undefined},
  ]);
});
