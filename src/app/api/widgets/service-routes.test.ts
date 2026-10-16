import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { IntegrationInstance } from '@/lib/types';
const state = vi.hoisted(() => ({ demo: false, admin: true, settings: { integrationId: 'dns-one' } as Record<string, unknown>, instances: [] as IntegrationInstance[], visible: true }));
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: state.instances }) }));
vi.mock('@/lib/demoMode', () => ({ isDemoMode: () => state.demo }));
vi.mock('@/lib/auth', () => ({ checkAdmin: () => state.admin ? null : NextResponse.json({ error: 'widgets.error.unauthorized' }, { status: 401 }), isAdmin: () => state.admin }));
vi.mock('@/lib/widgetData/resolve', () => ({ resolveWidgetSettings: vi.fn((_req, _id, _type, draft) => state.visible ? { ok: true, settings: state.admin && draft ? draft : state.settings, principal: { role: state.admin ? 'admin' : 'viewer' } } : { ok: false, status: 404, error: 'widgets.error.notFound' }) }));
vi.mock('@/lib/widgetData/services', async original => ({ ...await original<typeof import('@/lib/widgetData/services')>(), serviceJson: vi.fn(), serviceBytes: vi.fn() }));
vi.mock('@/integrations/pihole/collect', () => ({ collectPihole: vi.fn(), togglePihole: vi.fn() }));
vi.mock('@/integrations/adguard/collect', () => ({ collectAdguard: vi.fn(), toggleAdguard: vi.fn() }));
vi.mock('@/integrations/technitium/collect', async original => ({ ...await original<typeof import('@/integrations/technitium/collect')>(), collectTechnitium: vi.fn(), toggleTechnitium: vi.fn(), technitiumNodes: vi.fn() }));
vi.mock('@/integrations/immich/collect', () => ({ collectImmich: vi.fn(), immichAlbums: vi.fn(), immichHeaders: () => ({ 'x-api-key': 'fake-key' }) }));
vi.mock('@/integrations/photoprism/collect', () => ({ collectPhotoprism: vi.fn(), photoprismAlbums: vi.fn(), photoprismHeaders: () => ({ Authorization: 'Bearer fake-token' }), photoprismPreviewToken: vi.fn() }));
import { GET as dnsGet, POST as dnsPost } from './dns/route';
import { GET as photosGet } from './photos/route';
import { GET as imageGet } from './photos/image/route';
import { GET as albumsGet } from './photos/albums/route';
import { collectPihole, togglePihole } from '@/integrations/pihole/collect';
import { collectAdguard } from '@/integrations/adguard/collect';
import { collectTechnitium, technitiumNodes, toggleTechnitium } from '@/integrations/technitium/collect';
import { GET as nodesGet } from './dns/nodes/route';
import { collectImmich, immichAlbums } from '@/integrations/immich/collect';
import { collectPhotoprism, photoprismPreviewToken } from '@/integrations/photoprism/collect';
import { demoDns, demoPhotos, rememberPhoto, rememberWidgetPhoto, serviceBytes, serviceJson, ServiceError } from '@/lib/widgetData/services';
const instance = (id: string, type: string): IntegrationInstance => ({ id, type, name: `Fictional ${id}`, settings: { url: 'http://fixture.example.com' }, secrets: { password: 'fake-password' } });
const get = (path: string) => new NextRequest(`http://nasdash.example.com/api/widgets/${path}`);
const toggle = (body: unknown) => new NextRequest('http://nasdash.example.com/api/widgets/dns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  state.demo = false; state.admin = true; state.visible = true;
  state.instances = [instance('dns-one', 'pihole'), instance('dns-two', 'adguard'), instance('photos-one', 'immich'), instance('photos-two', 'photoprism')];
  state.settings = { integrationId: 'dns-one' };
});

describe('DNS routes', () => {
  it('rejects non-admin toggles before resolving or contacting an instance', async () => {
    state.admin = false;
    expect((await dnsPost(toggle({ widgetId: 'dns-widget', blocking: false }))).status).toBe(401);
    expect(togglePihole).not.toHaveBeenCalled(); expect(collectPihole).not.toHaveBeenCalled();
  });
  it('rejects wrong-type/missing instances and hidden widgets', async () => {
    state.settings = { integrationId: 'photos-one' };
    expect((await dnsGet(get('dns?widgetId=w'))).status).toBe(404);
    state.settings = { integrationId: 'unknown' };
    expect((await dnsPost(toggle({ widgetId: 'w', blocking: false }))).status).toBe(404);
    state.visible = false;
    expect((await dnsGet(get('dns?widgetId=w'))).status).toBe(404);
    expect(collectPihole).not.toHaveBeenCalled();
  });
  it('selects by saved instance ID and supports admin draft previews', async () => {
    state.settings = { integrationId: 'dns-two' };
    vi.mocked(collectAdguard).mockResolvedValue(demoDns(state.instances[1]));
    expect((await dnsGet(get('dns?widgetId=w'))).status).toBe(200);
    expect(collectAdguard).toHaveBeenCalledWith(state.instances[1]);
    expect(collectPihole).not.toHaveBeenCalled();
    state.demo = true;
    const draft = encodeURIComponent(JSON.stringify({ integrationId: 'dns-one' }));
    expect((await (await dnsGet(get(`dns?widgetId=w&draft=${draft}`))).json()).provider).toBe('pihole');
    state.admin = false;
    expect((await (await dnsGet(get(`dns?widgetId=w&draft=${draft}`))).json()).provider).toBe('adguard');
  });
  it('reads a Technitium node, one cache entry per node, and refuses an invalid node', async () => {
    state.instances.push(instance('dns-three', 'technitium'));
    vi.mocked(collectTechnitium).mockImplementation(async (source, node) => ({ ...demoDns(source), name: node ?? 'self' }));
    state.settings = { integrationId: 'dns-three', node: 'dns2.home.example' };
    expect((await (await dnsGet(get('dns?widgetId=w'))).json()).name).toBe('dns2.home.example');
    state.settings = { integrationId: 'dns-three', node: 'cluster' };
    expect((await (await dnsGet(get('dns?widgetId=w'))).json()).name).toBe('cluster');
    expect(collectTechnitium).toHaveBeenCalledTimes(2);
    state.settings = { integrationId: 'dns-three', node: 'x&token=stolen' };
    expect((await dnsGet(get('dns?widgetId=w'))).status).toBe(400);
    vi.mocked(collectTechnitium).mockClear();
    state.settings = { integrationId: 'dns-three', node: 'dns2.home.example' };
    expect((await dnsPost(toggle({ widgetId: 'w', blocking: false, durationSeconds: 300 }))).status).toBe(200);
    expect(toggleTechnitium).toHaveBeenCalledWith(state.instances[4], false, 300, 'dns2.home.example');
  });
  it('lists Technitium nodes to administrators only', async () => {
    state.instances.push(instance('dns-three', 'technitium'));
    vi.mocked(technitiumNodes).mockResolvedValue({ cluster: true, nodes: ['dns1.home.example'] });
    expect(await (await nodesGet(get('dns/nodes?integrationId=dns-three'))).json()).toEqual({ cluster: true, nodes: ['dns1.home.example'] });
    expect((await nodesGet(get('dns/nodes?integrationId=dns-one'))).status).toBe(404);
    state.admin = false;
    expect((await nodesGet(get('dns/nodes?integrationId=dns-three'))).status).toBe(401);
  });
  it('toggles then returns a fresh summary and invalidates cached GETs', async () => {
    const source = state.instances[0];
    vi.mocked(collectPihole).mockResolvedValueOnce(demoDns(source)).mockResolvedValue(demoDns(source, false));
    await dnsGet(get('dns?widgetId=w'));
    await dnsGet(get('dns?widgetId=w'));
    expect(collectPihole).toHaveBeenCalledTimes(1);
    const response = await dnsPost(toggle({ widgetId: 'w', blocking: false, durationSeconds: 60 }));
    expect(togglePihole).toHaveBeenCalledWith(source, false, 60);
    expect((await response.json()).blocking).toBe(false);
    await dnsGet(get('dns?widgetId=w'));
    expect(collectPihole).toHaveBeenCalledTimes(3);
  });
  it.each([{ blocking: 'false' }, { blocking: false, durationSeconds: -1 }, { blocking: false, durationSeconds: 1.5 }, { blocking: false, durationSeconds: 86401 }])('rejects invalid toggle payload %j', async body => {
    expect((await dnsPost(toggle({ widgetId: 'w', ...body }))).status).toBe(400);
    expect(togglePihole).not.toHaveBeenCalled();
  });
  it('returns translated provider errors and timeout status', async () => {
    state.instances[0] = instance('error-dns', 'pihole'); state.settings.integrationId = 'error-dns';
    vi.mocked(collectPihole).mockRejectedValue(new ServiceError('widgets.error.timeout', 504));
    const response = await dnsGet(get('dns?widgetId=w'));
    expect(response.status).toBe(504); expect(await response.json()).toEqual({ error: 'widgets.error.timeout' });
  });
  it('reads the first saved DNS connection when the widget chose none', async () => {
    state.settings = {};
    state.demo = true;
    expect((await (await dnsGet(get('dns?widgetId=w'))).json()).name).toBe(state.instances[0].name);
  });
});

describe('Photo routes', () => {
  it('rejects wrong-type instances and bad selections', async () => {
    expect((await photosGet(get('photos?widgetId=w'))).status).toBe(404);
    state.settings = { integrationId: 'photos-one', mode: 'album', albumId: '../x' };
    expect((await photosGet(get('photos?widgetId=w'))).status).toBe(400);
    expect(collectImmich).not.toHaveBeenCalled();
  });
  it('caches per instance/selection/seed and rebuilds URLs for each widget', async () => {
    state.settings = { integrationId: 'photos-one', count: 3 };
    vi.mocked(collectImmich).mockResolvedValue(demoPhotos(state.instances[2], 3, '', ''));
    const first = await (await photosGet(get('photos?widgetId=first&seed=a'))).json();
    const second = await (await photosGet(get('photos?widgetId=second&seed=a'))).json();
    expect(first.photos[0].thumb).toContain('widgetId=first');
    expect(second.photos[0].thumb).toContain('widgetId=second');
    expect(collectImmich).toHaveBeenCalledTimes(1);
    await photosGet(get('photos?widgetId=first&seed=b'));
    expect(collectImmich).toHaveBeenCalledTimes(2);
  });
  it('albums require admin and select the correct saved photo instance', async () => {
    state.admin = false;
    expect((await albumsGet(get('photos/albums?integrationId=photos-one'))).status).toBe(401);
    state.admin = true;
    expect((await albumsGet(get('photos/albums?integrationId=dns-one'))).status).toBe(404);
    vi.mocked(immichAlbums).mockResolvedValue([{ id: '00000000-0000-4000-8000-000000000060', name: 'Summer Trails', count: 12 }]);
    expect((await albumsGet(get('photos/albums?integrationId=photos-one'))).status).toBe(200);
    expect(immichAlbums).toHaveBeenCalledWith(state.instances[2]);
  });
  it.each(['../secrets', '00000000-0000-4000-8000-000000000000/evil', '%2e%2e', 'bad-id'])('image rejects invalid id %s before transport', async id => {
    state.settings = { integrationId: 'photos-one' };
    expect((await imageGet(get(`photos/image?widgetId=w&id=${encodeURIComponent(id)}`))).status).toBe(400);
    expect(serviceBytes).not.toHaveBeenCalled();
  });
  it('rejects unknown images even if their format is valid', async () => {
    state.settings = { integrationId: 'photos-one' };
    expect((await imageGet(get('photos/image?widgetId=w&id=00000000-0000-4000-8000-000000000088'))).status).toBe(404);
    expect(serviceBytes).not.toHaveBeenCalled();
  });
  it('proxies only image bytes with private cache and correct Immich size', async () => {
    state.settings = { integrationId: 'photos-one' };
    const id = '00000000-0000-4000-8000-000000000070';
    rememberPhoto(state.instances[2], id); rememberWidgetPhoto(state.instances[2], 'w', id);
    vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('fictional'), contentType: 'image/jpeg', status: 200 });
    const response = await imageGet(get(`photos/image?widgetId=w&id=${id}&size=preview`));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, max-age=86400');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(vi.mocked(serviceBytes).mock.calls[0][1]).toBe(`/api/assets/${id}/thumbnail?size=preview`);
    vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('<html>'), contentType: 'text/html', status: 200 });
    expect((await imageGet(get(`photos/image?widgetId=w&id=${id}`))).status).toBe(502);
  });
  it('serves a photo only through the widget that listed it, and the library link to admins only', async () => {
    state.settings = { integrationId: 'photos-one' };
    const id = '00000000-0000-4000-8000-000000000071';
    rememberPhoto(state.instances[2], id); rememberWidgetPhoto(state.instances[2], 'other-widget', id);
    expect((await imageGet(get(`photos/image?widgetId=w&id=${id}`))).status).toBe(404);
    expect(serviceBytes).not.toHaveBeenCalled();
    vi.mocked(collectImmich).mockResolvedValue({ provider: 'immich', name: 'Fictional', photos: [{ id, thumb: '', preview: '', link: 'http://service.example.com/photos/x' }], fetchedAt: 1 });
    state.admin = false;
    const forViewer = await (await photosGet(get('photos?widgetId=w&seed=link-1'))).json();
    expect(forViewer.photos[0].link).toBeUndefined();
    state.admin = true;
    const forAdmin = await (await photosGet(get('photos?widgetId=w&seed=link-2'))).json();
    expect(forAdmin.photos[0].link).toBe('http://service.example.com/photos/x');
  });
  it('resolves PhotoPrism hashes and preview token server-side only', async () => {
    state.settings = { integrationId: 'photos-two' };
    const id = 'pdemo00000000070', hash = 'a'.repeat(40);
    rememberPhoto(state.instances[3], id, hash); rememberWidgetPhoto(state.instances[3], 'w', id);
    vi.mocked(photoprismPreviewToken).mockResolvedValue('fictional-preview');
    vi.mocked(serviceBytes).mockResolvedValue({ bytes: Buffer.from('fixture'), contentType: 'image/webp', status: 200 });
    expect((await imageGet(get(`photos/image?widgetId=w&id=${id}`))).status).toBe(200);
    expect(vi.mocked(serviceBytes).mock.calls[0][1]).toBe(`/api/v1/t/${hash}/fictional-preview/fit_720`);
  });
});

describe('fictional demo services', () => {
  it('all routes and toggle never fetch from providers', async () => {
    state.demo = true;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Demo fetched'));
    try {
      expect((await dnsGet(get('dns?widgetId=w'))).status).toBe(200);
      const response = await dnsPost(toggle({ widgetId: 'w', blocking: false, durationSeconds: 60 }));
      expect((await response.json()).blocking).toBe(false);
      state.settings = { integrationId: 'photos-one', count: 4 };
      const photos = await (await photosGet(get('photos?widgetId=w&seed=3'))).json();
      const image = await imageGet(get(`photos/image?widgetId=w&id=${photos.photos[0].id}`));
      expect(image.headers.get('content-type')).toBe('image/svg+xml');
      expect(await image.text()).toContain('<svg');
      expect((await albumsGet(get('photos/albums?integrationId=photos-one'))).status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled(); expect(serviceJson).not.toHaveBeenCalled(); expect(serviceBytes).not.toHaveBeenCalled();
      expect(collectPihole).not.toHaveBeenCalled(); expect(collectImmich).not.toHaveBeenCalled(); expect(collectPhotoprism).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
});
