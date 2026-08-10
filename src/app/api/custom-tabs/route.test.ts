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
import { POST } from './route';

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
});
