import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  checkAdmin: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
  writeServices: vi.fn(),
  writeCalendar: vi.fn(),
}));

import { checkAdmin } from '@/lib/auth';
import { readConfig, writeConfig } from '@/lib/config';
import { PUT } from './route';

const mockedCheckAdmin = vi.mocked(checkAdmin);
const mockedReadConfig = vi.mocked(readConfig);
const mockedWriteConfig = vi.mocked(writeConfig);

describe('configuration write contracts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedCheckAdmin.mockReturnValue(null);
    mockedWriteConfig.mockReturnValue(true);
    mockedReadConfig.mockReturnValue({
      version: 1,
      categories: [],
      settings: { title: 'NasDash', showMonitor: true },
    });
  });

  it('accepts a realistically large automatically generated network topology', async () => {
    const nodes = Array.from({ length: 300 }, (_, index) => ({
      id: `auto-node-${index}`,
      name: `Service ${index}`,
      type: 'stdsvc',
      icon: 'Server',
      ip: `10.0.${Math.floor(index / 254)}.${(index % 254) + 1}`,
    }));
    const connections = Array.from({ length: 1000 }, (_, index) => ({
      id: `auto-connection-${index}`,
      fromId: nodes[index % nodes.length].id,
      toId: nodes[(index + 1) % nodes.length].id,
      type: 'directional',
    }));
    const payload = JSON.stringify({
      type: 'settings',
      networkTopology: { nodes, groups: [], connections },
    });
    expect(new TextEncoder().encode(payload).byteLength).toBeLessThan(2 * 1024 * 1024);

    const response = await PUT(new Request('http://localhost/api/config', {
      method: 'PUT',
      body: payload,
    }) as never);

    expect(response.status).toBe(200);
    expect(mockedWriteConfig).toHaveBeenCalledOnce();
    expect(mockedWriteConfig.mock.calls[0][0].settings.networkTopology?.nodes).toHaveLength(300);
    expect(mockedWriteConfig.mock.calls[0][0].settings.networkTopology?.connections).toHaveLength(1000);
  });
});
