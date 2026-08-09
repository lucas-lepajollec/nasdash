import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  readUsers: vi.fn(),
  writeUsers: vi.fn(),
  checkAdmin: vi.fn(),
  hashPassword: vi.fn(() => 'new-hash'),
  getSessionFromRequest: vi.fn(),
}));

import { checkAdmin, readUsers, writeUsers } from '@/lib/auth';
import { POST } from './route';

const mockedCheckAdmin = vi.mocked(checkAdmin);
const mockedReadUsers = vi.mocked(readUsers);
const mockedWriteUsers = vi.mocked(writeUsers);

describe('user session revocation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedCheckAdmin.mockReturnValue(null);
    mockedWriteUsers.mockReturnValue(true);
    mockedReadUsers.mockReturnValue([{
      username: 'alice',
      role: 'viewer',
      passwordHash: 'old-hash',
      allowedTabs: ['dashboard'],
      allowedWidgets: ['calendar'],
      sessionVersion: 4,
    }]);
  });

  it('increments the session version when permissions change', async () => {
    const request = {
      json: async () => ({
        username: 'alice',
        role: 'viewer',
        allowedTabs: ['dashboard', 'docker'],
        allowedWidgets: ['calendar'],
      }),
    };

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(mockedWriteUsers).toHaveBeenCalledOnce();
    expect(mockedWriteUsers.mock.calls[0][0][0]).toMatchObject({
      allowedTabs: ['dashboard', 'docker'],
      sessionVersion: 5,
    });
  });

  it('surfaces a persistence failure instead of reporting success', async () => {
    mockedWriteUsers.mockReturnValue(false);
    const request = {
      json: async () => ({
        username: 'alice',
        role: 'viewer',
        allowedTabs: ['dashboard'],
        allowedWidgets: ['calendar'],
      }),
    };

    const response = await POST(request as never);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Impossible d’enregistrer les utilisateurs.' });
  });
});
