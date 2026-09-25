import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagesDocument } from '@/lib/pages/types';

vi.mock('@/lib/auth', () => ({ checkAdmin: vi.fn() }));
vi.mock('@/lib/access', () => ({ resolveAccessPrincipal: vi.fn() }));
vi.mock('@/lib/config', () => ({ readConfig: vi.fn() }));
vi.mock('@/lib/pages/store', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/pages/store')>();
  return { ...original, readPagesDocument: vi.fn(), writePagesDocument: vi.fn() };
});

import { checkAdmin } from '@/lib/auth';
import { resolveAccessPrincipal } from '@/lib/access';
import { readConfig } from '@/lib/config';
import { readPagesDocument, writePagesDocument } from '@/lib/pages/store';
import { buildOfficialPage } from '@/lib/pages/presets';
import { DELETE, GET, POST, PUT } from './route';

const mockedCheckAdmin = vi.mocked(checkAdmin);
const mockedPrincipal = vi.mocked(resolveAccessPrincipal);
const mockedRead = vi.mocked(readPagesDocument);
const mockedWrite = vi.mocked(writePagesDocument);

function documentFixture(): PagesDocument {
  const categories = [{ id: 'media', title: 'Media', emoji: '🎬', order: 0, services: [] }];
  return {
    schemaVersion: 5,
    pages: [
      { ...buildOfficialPage('dashboard', { categories }), revision: 3 },
      { ...buildOfficialPage('docker', { categories }), revision: 1 },
      { ...buildOfficialPage('networks', { categories }), revision: 1 },
    ],
  };
}

const request = (method: string, body?: unknown, url = 'http://localhost/api/pages') => new Request(url, {
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}) as never;

describe('/api/pages', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedCheckAdmin.mockReturnValue(null);
    vi.mocked(readConfig).mockReturnValue({ version: 1, categories: [], settings: { title: 'NasDash', showMonitor: true } });
    mockedRead.mockImplementation(() => documentFixture());
    mockedPrincipal.mockReturnValue({ username: 'admin', role: 'admin', allowedTabs: [], allowedWidgets: [], isAnonymous: false });
  });

  it('filters pages and widget views for restricted viewers without shifting masonry slots', async () => {
    mockedPrincipal.mockReturnValue({ username: 'viewer', role: 'viewer', allowedTabs: ['dashboard'], allowedWidgets: ['clock'], isAnonymous: true });
    const response = await GET(request('GET'));
    const { pages } = await response.json();
    expect(pages.map((page: { id: string }) => page.id)).toEqual(['dashboard']);
    const types = pages[0].widgets.map((widget: { type: string }) => widget.type);
    expect(types).toContain('clock');
    expect(types).toContain('service-category');
    expect(types).not.toContain('devices');
    expect(types).not.toContain('weather');
    expect(pages[0].widgets.find((widget: { type: string }) => widget.type === 'clock')).toMatchObject({ id: 'dashboard-clock-1', x: 0, y: 0 });
  });

  it('rejects anonymous access to private dashboards', async () => {
    mockedPrincipal.mockReturnValue(null);
    expect((await GET(request('GET'))).status).toBe(401);
  });

  it('saves a page with the expected revision and increments it', async () => {
    const page = documentFixture().pages[0];
    const response = await PUT(request('PUT', { page: { ...page, name: 'Accueil' } }));
    expect(response.status).toBe(200);
    const saved = mockedWrite.mock.calls[0][0].pages[0];
    expect(saved).toMatchObject({ name: 'Accueil', revision: 4, preset: 'dashboard' });
  });

  it('refuses a stale revision and returns the current page', async () => {
    const page = documentFixture().pages[0];
    const response = await PUT(request('PUT', { page: { ...page, revision: 2 } }));
    expect(response.status).toBe(409);
    expect((await response.json()).page.revision).toBe(3);
    expect(mockedWrite).not.toHaveBeenCalled();
  });

  it('refuses a second topology on another page', async () => {
    const page = documentFixture().pages[1];
    page.widgets.push({ id: 'second-map', type: 'network-topology', settings: {}, x: 0, y: 200, w: 9, h: 90 });
    const response = await PUT(request('PUT', { page }));
    expect(response.status).toBe(409);
    expect(mockedWrite).not.toHaveBeenCalled();
  });

  it('refuses invalid structures and non-admin writes', async () => {
    const page = documentFixture().pages[0];
    page.widgets[0] = { ...page.widgets[0], x: 24 };
    expect((await PUT(request('PUT', { page }))).status).toBe(400);
    mockedCheckAdmin.mockReturnValue(new Response(null, { status: 401 }) as never);
    expect((await PUT(request('PUT', { page: documentFixture().pages[0] }))).status).toBe(401);
    expect(mockedWrite).not.toHaveBeenCalled();
  });

  it('creates pages from templates as ordinary pages', async () => {
    vi.mocked(readConfig).mockReturnValue({
      version: 1,
      categories: [{ id: 'media', title: 'Media', emoji: '🎬', order: 0, services: [] }],
      settings: { title: 'NasDash', showMonitor: true },
    });
    const response = await POST(request('POST', { action: 'create', name: 'Media', icon: '🎬', template: 'dashboard' }));
    expect(response.status).toBe(201);
    const { page } = await response.json();
    expect(page.id).toMatch(/^page_/);
    expect(page.preset).toBeUndefined();
    expect(page.widgets.some((widget: { type: string }) => widget.type === 'service-category')).toBe(true);
  });

  it('restores an official preset with a backup and duplicates without single-instance widgets', async () => {
    const restored = await POST(request('POST', { action: 'restore', id: 'dashboard' }));
    expect(restored.status).toBe(200);
    expect(mockedWrite.mock.calls[0][1]).toEqual({ backup: true });
    const duplicate = await POST(request('POST', { action: 'duplicate', id: 'networks' }));
    const { page } = await duplicate.json();
    expect(page.widgets.some((widget: { type: string }) => widget.type === 'network-topology')).toBe(false);
  });

  it('deletes a page with a backup', async () => {
    const response = await DELETE(request('DELETE', undefined, 'http://localhost/api/pages?id=docker'));
    expect(response.status).toBe(200);
    expect(mockedWrite.mock.calls[0][0].pages.map((page: { id: string }) => page.id)).toEqual(['dashboard', 'networks']);
    expect(mockedWrite.mock.calls[0][1]).toEqual({ backup: true });
  });
});
