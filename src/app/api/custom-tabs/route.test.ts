import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  checkAdmin: vi.fn(),
}));

vi.mock('@/lib/customTabs', () => ({
  readCustomTabs: vi.fn(),
  writeCustomTabs: vi.fn(),
}));

import { checkAdmin } from '@/lib/auth';
import { readCustomTabs, writeCustomTabs } from '@/lib/customTabs';
import { POST, PUT } from './route';

const mockedCheckAdmin = vi.mocked(checkAdmin);
const mockedReadCustomTabs = vi.mocked(readCustomTabs);
const mockedWriteCustomTabs = vi.mocked(writeCustomTabs);

describe('custom tab persistence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedCheckAdmin.mockReturnValue(null);
    mockedReadCustomTabs.mockReturnValue({ tabs: [], layouts: {} });
  });

  it('does not report success when the JSON file cannot be written', async () => {
    mockedWriteCustomTabs.mockReturnValue(false);
    const request = new Request('http://localhost/api/custom-tabs', {
      method: 'POST',
      body: JSON.stringify({
        type: 'createTab',
        name: 'Infrastructure',
        layout: { rows: [] },
      }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Impossible d’enregistrer les onglets personnalisés.',
    });
  });

  it('keeps accepting layout-only saves sent by the live custom tab renderer', async () => {
    mockedWriteCustomTabs.mockReturnValue(true);
    mockedReadCustomTabs.mockReturnValue({
      tabs: [{
        id: 'custom_status',
        name: 'Status',
        icon: '📊',
        description: 'Monitoring',
        isCustom: true,
      }],
      layouts: { custom_status: { id: 'custom_status', rows: [] } },
    });
    const layout = {
      id: 'custom_status',
      rows: [{
        id: 'row_1',
        type: 'full',
        columns: [{
          id: 'column_1',
          width: 100,
          widgets: [{ id: 'widget_1', type: 'clock', props: { timezone: 'Europe/Paris' } }],
        }],
      }],
    };

    const response = await PUT(new Request('http://localhost/api/custom-tabs', {
      method: 'PUT',
      body: JSON.stringify({ id: 'custom_status', layout }),
    }) as never);

    expect(response.status).toBe(200);
    expect(mockedWriteCustomTabs).toHaveBeenCalledOnce();
    expect(mockedWriteCustomTabs.mock.calls[0][0].layouts.custom_status.rows).toHaveLength(1);
  });
});
