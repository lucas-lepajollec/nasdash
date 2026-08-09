import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({
  getSessionFromRequest: vi.fn(),
  readUsers: vi.fn(),
}));

import { getSessionFromRequest, readUsers } from './auth';
import { resolveAccessPrincipal } from './access';

const mockedSession = vi.mocked(getSessionFromRequest);
const mockedUsers = vi.mocked(readUsers);

describe('request principal resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedUsers.mockReturnValue([
      {
        username: 'viewer',
        role: 'viewer',
        passwordHash: 'unused:test-hash',
        allowedTabs: ['dashboard'],
        allowedWidgets: ['calendar'],
      },
    ]);
  });

  it('maps an anonymous public request to the configured viewer permissions', () => {
    mockedSession.mockReturnValue(null);

    expect(resolveAccessPrincipal({}, 'public')).toEqual({
      username: 'viewer',
      role: 'viewer',
      allowedTabs: ['dashboard'],
      allowedWidgets: ['calendar'],
      isAnonymous: true,
    });
  });

  it('rejects an anonymous request in private mode', () => {
    mockedSession.mockReturnValue(null);

    expect(resolveAccessPrincipal({}, 'private')).toBeNull();
  });

  it('uses the current stored role and permissions instead of stale JWT claims', () => {
    mockedSession.mockReturnValue({
      username: 'viewer',
      role: 'admin',
      allowedTabs: [],
      allowedWidgets: [],
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    expect(resolveAccessPrincipal({}, 'private')).toMatchObject({
      role: 'viewer',
      allowedTabs: ['dashboard'],
      allowedWidgets: ['calendar'],
      isAnonymous: false,
    });
  });

  it('rejects a validly signed session when its user no longer exists', () => {
    mockedSession.mockReturnValue({
      username: 'deleted-user',
      role: 'viewer',
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    expect(resolveAccessPrincipal({}, 'private')).toBeNull();
  });
});
