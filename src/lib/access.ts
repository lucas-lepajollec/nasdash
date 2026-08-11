import { NextResponse } from 'next/server';
import { getSessionFromRequest, readUsers, type AuthRequestLike } from './auth';
import { isDemoMode } from './demoMode';

export type SecurityMode = 'public' | 'private';

export interface AccessPrincipal {
  username: string;
  role: 'admin' | 'viewer';
  allowedTabs: string[];
  allowedWidgets: string[];
  isAnonymous: boolean;
}

export interface ReadAccessRequirement {
  tabs?: string[];
  widgets?: string[];
}

export const READ_ACCESS = {
  topology: { tabs: ['networks'], widgets: ['networkgraph'] },
  calendar: { widgets: ['calendar'] },
  dockerContainers: { tabs: ['docker', 'networks'], widgets: ['dockercontainers'] },
  dockerDetails: { tabs: ['docker'] },
  devices: { tabs: ['dashboard'], widgets: ['devices', 'quickstats'] },
  tailscale: { tabs: ['networks'], widgets: ['tailscale'] },
  ping: { tabs: ['dashboard'], widgets: ['quickstats', 'networkgraph'] },
} satisfies Record<string, ReadAccessRequirement>;

function normalizePermissions(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))];
}

export function resolveAccessPrincipal(
  req: AuthRequestLike,
  securityMode: SecurityMode = 'public'
): AccessPrincipal | null {
  // The public showcase has no real authentication flow. Give its isolated,
  // short-lived session enough access to preview every read-only surface even
  // when a visitor temporarily changes the simulated security mode.
  if (isDemoMode()) {
    return {
      username: 'demo',
      role: 'admin',
      allowedTabs: [],
      allowedWidgets: [],
      isAnonymous: false,
    };
  }

  const session = getSessionFromRequest(req);
  const users = readUsers();

  if (session) {
    const currentUser = users.find(
      user => user.username.toLowerCase() === session.username.toLowerCase()
    );
    if (!currentUser) return null;

    return {
      username: currentUser.username,
      role: currentUser.role,
      allowedTabs: normalizePermissions(currentUser.allowedTabs),
      allowedWidgets: normalizePermissions(currentUser.allowedWidgets),
      isAnonymous: false,
    };
  }

  if (securityMode !== 'public') return null;

  const viewer = users.find(user => user.username.toLowerCase() === 'viewer');
  if (!viewer) return null;

  return {
    username: viewer.username,
    role: 'viewer',
    allowedTabs: normalizePermissions(viewer.allowedTabs),
    allowedWidgets: normalizePermissions(viewer.allowedWidgets),
    isAnonymous: true,
  };
}

function permissionListAllows(values: string[], resource: string): boolean {
  // Backward compatibility: historically an empty list meant unrestricted access.
  return values.length === 0 || values.includes(resource);
}

export function canAccessTab(principal: AccessPrincipal, tabId: string): boolean {
  return principal.role === 'admin' || permissionListAllows(principal.allowedTabs, tabId);
}

export function canAccessWidget(principal: AccessPrincipal, widgetId: string): boolean {
  return principal.role === 'admin' || permissionListAllows(principal.allowedWidgets, widgetId);
}

export function canReadResource(
  principal: AccessPrincipal,
  requirement: ReadAccessRequirement
): boolean {
  if (principal.role === 'admin') return true;

  const tabAllowed = (requirement.tabs || []).some(tab => canAccessTab(principal, tab));
  const widgetAllowed = (requirement.widgets || []).some(widget => canAccessWidget(principal, widget));

  return tabAllowed || widgetAllowed;
}

export function checkReadAccess(
  req: AuthRequestLike,
  securityMode: SecurityMode,
  requirement: ReadAccessRequirement
): { principal: AccessPrincipal; error: null } | { principal: null; error: NextResponse } {
  const principal = resolveAccessPrincipal(req, securityMode);
  if (!principal) {
    return {
      principal: null,
      error: NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 }),
    };
  }

  if (!canReadResource(principal, requirement)) {
    return {
      principal: null,
      error: NextResponse.json({ error: 'Permission insuffisante.' }, { status: 403 }),
    };
  }

  return { principal, error: null };
}
