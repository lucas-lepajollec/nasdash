import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import type { DashboardConfig } from './types';
import { isDemoMode } from './demoMode';

export const DEMO_SESSION_COOKIE = 'nasdash_demo_session';
const SESSION_TTL_SECONDS = 30 * 60;
// Bound per-instance memory usage on an anonymous public deployment. A busy
// server may evict the oldest sandbox sooner; no real or durable data is lost.
const MAX_SESSIONS = 64;

interface DemoSessionState {
  config?: DashboardConfig;
  customTabs?: unknown;
  pages?: unknown;
  containerStates: Map<string, string>;
  removedContainers: Set<string>;
  removedImages: Set<string>;
  removedVolumes: Set<string>;
  expiresAt: number;
}

interface DemoSessionGlobal {
  __demoSessionStorage?: AsyncLocalStorage<string>;
  __demoSessions?: Map<string, DemoSessionState>;
  __demoWorkspaceStorage?: AsyncLocalStorage<DemoSessionState>;
}

const demoGlobal = globalThis as typeof globalThis & DemoSessionGlobal;
demoGlobal.__demoSessionStorage ||= new AsyncLocalStorage<string>();
demoGlobal.__demoSessions ||= new Map<string, DemoSessionState>();

const storage = demoGlobal.__demoSessionStorage;
const sessions = demoGlobal.__demoSessions;
demoGlobal.__demoWorkspaceStorage ||= new AsyncLocalStorage<DemoSessionState>();
const workspaceStorage = demoGlobal.__demoWorkspaceStorage;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cleanupExpiredSessions(now: number): void {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

function readSessionId(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${DEMO_SESSION_COOKIE}=([a-f0-9-]{16,64})(?:;|$)`, 'i'));
  return match?.[1] || null;
}

function getOrCreateSession(id: string): DemoSessionState {
  const now = Date.now();
  cleanupExpiredSessions(now);
  let session = sessions.get(id);
  if (!session) {
    while (sessions.size >= MAX_SESSIONS) {
      const oldestId = sessions.keys().next().value as string | undefined;
      if (!oldestId) break;
      sessions.delete(oldestId);
    }
    session = {
      containerStates: new Map<string, string>(),
      removedContainers: new Set<string>(),
      removedImages: new Set<string>(),
      removedVolumes: new Set<string>(),
      expiresAt: now + SESSION_TTL_SECONDS * 1000,
    };
    sessions.set(id, session);
  } else {
    session.removedContainers ||= new Set<string>();
    session.removedImages ||= new Set<string>();
    session.removedVolumes ||= new Set<string>();
    session.expiresAt = now + SESSION_TTL_SECONDS * 1000;
    // Map insertion order acts as a small LRU queue.
    sessions.delete(id);
    sessions.set(id, session);
  }
  return session;
}

function currentSession(): DemoSessionState | null {
  const workspace = workspaceStorage.getStore();
  if (workspace) return workspace;
  const id = storage.getStore();
  return id ? getOrCreateSession(id) : null;
}

export async function withDemoSession<T extends NextResponse>(
  request: Request,
  handler: () => Promise<T>,
): Promise<T> {
  if (!isDemoMode() || workspaceStorage.getStore() || storage.getStore()) return handler();

  const existingId = readSessionId(request);
  const sessionId = existingId || crypto.randomUUID();
  getOrCreateSession(sessionId);
  const response = await storage.run(sessionId, handler);

  const secure = new URL(request.url).protocol === 'https:';
  response.cookies.set({
    name: DEMO_SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export function getDemoSessionConfig(): DashboardConfig | null {
  const config = currentSession()?.config;
  return config ? cloneJson(config) : null;
}

export function setDemoSessionConfig(config: DashboardConfig): boolean {
  const session = currentSession();
  if (!session) return false;
  session.config = cloneJson(config);
  return true;
}

export function getDemoSessionCustomTabs<T>(): T | null {
  const data = currentSession()?.customTabs;
  return data ? cloneJson(data as T) : null;
}

export function setDemoSessionCustomTabs<T>(data: T): boolean {
  const session = currentSession();
  if (!session) return false;
  session.customTabs = cloneJson(data);
  return true;
}

export function getDemoSessionPages<T>(): T | null {
  const data = currentSession()?.pages;
  return data ? cloneJson(data as T) : null;
}

export function setDemoSessionPages<T>(data: T): boolean {
  const session = currentSession();
  if (!session) return false;
  session.pages = cloneJson(data);
  return true;
}

export function getDemoContainerState(id: string, fallback: string): string {
  return currentSession()?.containerStates.get(normalizeDemoContainerId(id)) || fallback;
}

export function setDemoContainerState(id: string, state: string): void {
  currentSession()?.containerStates.set(normalizeDemoContainerId(id), state);
}

export function removeDemoContainer(id: string): void {
  currentSession()?.removedContainers.add(normalizeDemoContainerId(id));
}

export function isDemoContainerRemoved(id: string): boolean {
  return currentSession()?.removedContainers.has(normalizeDemoContainerId(id)) || false;
}

export function removeDemoImage(id: string): void {
  currentSession()?.removedImages.add(id);
}

export function isDemoImageRemoved(id: string): boolean {
  return currentSession()?.removedImages.has(id) || false;
}

export function removeDemoVolume(name: string): void {
  currentSession()?.removedVolumes.add(name);
}

export function isDemoVolumeRemoved(name: string): boolean {
  return currentSession()?.removedVolumes.has(name) || false;
}

export function normalizeDemoContainerId(id: string): string {
  return id.slice(0, 12);
}

export function clearDemoSession(request: Request): void {
  const id = readSessionId(request);
  if (id) sessions.delete(id);
}

/** JSON-only workspace carried by the demo browser, independent of worker affinity. */
export interface DemoWorkspace {
  config?: DashboardConfig;
  customTabs?: unknown;
  pages?: unknown;
  containerStates?: [string, string][];
  removedContainers?: string[];
  removedImages?: string[];
  removedVolumes?: string[];
}

export async function runDemoWorkspace<T>(workspace: DemoWorkspace, handler: () => Promise<T>): Promise<{ result: T; workspace: DemoWorkspace }> {
  if (!isDemoMode()) throw new Error('Demo workspace is unavailable in installed mode');
  // Portable requests must not join the cookie-session LRU: active requests
  // cannot be evicted by other visitors while their state is being mutated.
  const state: DemoSessionState = {
    config: workspace.config, customTabs: workspace.customTabs, pages: workspace.pages,
    containerStates: new Map(workspace.containerStates ?? []),
    removedContainers: new Set(workspace.removedContainers ?? []),
    removedImages: new Set(workspace.removedImages ?? []),
    removedVolumes: new Set(workspace.removedVolumes ?? []),
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  return workspaceStorage.run(state, async () => {
    const result = await handler();
    return { result, workspace: { config: state.config, customTabs: state.customTabs, pages: state.pages,
      containerStates: [...state.containerStates], removedContainers: [...state.removedContainers], removedImages: [...state.removedImages], removedVolumes: [...state.removedVolumes] } };
  });
}
