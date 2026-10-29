import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { safeWriteFileSync } from './config';
import { NextResponse } from 'next/server';
import { getDataPath } from './dataDirectory';
import { readOrCreatePersistentSecret } from './persistentSecret';
import { isDemoMode } from './demoMode';

const USERS_PATH = getDataPath('users.json');
const SECRET_FILE = getDataPath('jwt.secret');

export interface User {
  username: string;
  role: 'admin' | 'viewer';
  passwordHash: string;
  allowedTabs?: string[];
  allowedWidgets?: string[];
  sessionVersion: number;
}

export interface SessionPayload {
  username: string;
  role: 'admin' | 'viewer';
  allowedTabs?: string[];
  allowedWidgets?: string[];
  sessionVersion: number;
  exp: number;
}

interface HeaderReader {
  get(name: string): string | null | undefined;
}

interface CookieReader {
  get(name: string): { value?: string } | undefined;
}

export interface AuthRequestLike {
  url?: string;
  method?: string;
  headers?: HeaderReader | Record<string, string | undefined>;
  cookies?: CookieReader;
  req?: { method?: string };
}

function hasHeaderReader(headers: HeaderReader | Record<string, string | undefined>): headers is HeaderReader {
  return typeof (headers as HeaderReader).get === 'function';
}

function getRequestHeader(req: AuthRequestLike | undefined, name: string): string | null {
  const headers = req?.headers;
  if (!headers) return null;
  if (hasHeaderReader(headers)) return headers.get(name) || null;
  return headers[name] || headers[name.toLowerCase()] || null;
}

// Utiliser une clé persistante ou en générer une nouvelle à chaque démarrage
const authGlobal = globalThis as typeof globalThis & {
  __jwtSecretFallback?: string;
  __jwtSecret?: string;
  __cachedUsers?: User[] | null;
  __warnedAboutDefaultPasswords?: boolean;
};

function getJwtSecret(): string {
  let secret = process.env.NASDASH_JWT_SECRET?.trim();
  // Authentication is disabled in the public showcase. Keep an ephemeral
  // process-local key so demo deployments never need to read or create a
  // credential file on their read-only filesystem.
  if (!secret && isDemoMode()) {
    if (!authGlobal.__jwtSecretFallback) {
      authGlobal.__jwtSecretFallback = crypto.randomBytes(32).toString('hex');
    }
    return authGlobal.__jwtSecretFallback;
  }
  if (!secret) {
    try {
      secret = readOrCreatePersistentSecret(SECRET_FILE);
    } catch (e) {
      console.error('Failed to read/write persistent JWT secret:', e);
      if (!authGlobal.__jwtSecretFallback) {
        authGlobal.__jwtSecretFallback = crypto.randomBytes(32).toString('hex');
      }
      secret = authGlobal.__jwtSecretFallback;
    }
  }
  return secret;
}

if (!authGlobal.__jwtSecret) {
  authGlobal.__jwtSecret = getJwtSecret();
}
const JWT_SECRET = authGlobal.__jwtSecret;

if (!authGlobal.__cachedUsers) {
  authGlobal.__cachedUsers = null;
}

function getInitialPassword(username: 'admin' | 'viewer', generated: Array<{ username: string; password: string; envName: string }>): string {
  const envName = username === 'admin' ? 'NASDASH_ADMIN_PASSWORD' : 'NASDASH_VIEWER_PASSWORD';
  const configuredPassword = process.env[envName];
  if (configuredPassword) return configuredPassword;

  const generatedPassword = username === 'admin' ? setupCode() : crypto.randomBytes(18).toString('base64url');
  generated.push({ username, password: generatedPassword, envName });
  return generatedPassword;
}

/**
 * The administrator's first password, read from the container log and typed once on the first-start screen:
 * 12 characters in three groups, without look-alike characters (0/O, 1/I/L), about 59 bits.
 */
const SETUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function setupCode(): string {
  const bytes = crypto.randomBytes(12);
  const chars = Array.from(bytes, byte => SETUP_ALPHABET[byte % SETUP_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

// --- HACHAGE DE MOT DE PASSE (SCRYPT) ---

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch {
    return false;
  }
}

export function getDefaultPasswordUsernames(users: User[]): Array<'admin' | 'viewer'> {
  const defaultAccounts: Array<'admin' | 'viewer'> = [];

  for (const username of ['admin', 'viewer'] as const) {
    const user = users.find(candidate => candidate.username.toLowerCase() === username);
    if (user?.passwordHash && verifyPassword(username, user.passwordHash)) {
      defaultAccounts.push(username);
    }
  }

  return defaultAccounts;
}

// --- SESSION JWT NATIVE ---

export function generateToken(
  payload: Omit<SessionPayload, 'exp' | 'sessionVersion'> & { sessionVersion?: number },
  expiresInDays = 30
): string {
  const exp = Math.floor(Date.now() / 1000) + (expiresInDays * 24 * 60 * 60);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    sessionVersion: payload.sessionVersion ?? 0,
    exp,
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
    
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [header, body, signature] = parts;
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') return null;
  } catch {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
    
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }
  
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    const sessionVersion = decoded.sessionVersion ?? 0;
    if (
      typeof decoded.username !== 'string' ||
      !decoded.role ||
      !['admin', 'viewer'].includes(decoded.role) ||
      typeof decoded.exp !== 'number' ||
      decoded.exp < Math.floor(Date.now() / 1000) ||
      !Number.isInteger(sessionVersion) ||
      sessionVersion < 0
    ) {
      return null; // Expiré
    }
    return {
      username: decoded.username,
      role: decoded.role,
      allowedTabs: decoded.allowedTabs,
      allowedWidgets: decoded.allowedWidgets,
      sessionVersion,
      exp: decoded.exp,
    };
  } catch {
    return null;
  }
}

export function isSessionCurrentForUser(payload: SessionPayload, user: User): boolean {
  return (
    payload.username.toLowerCase() === user.username.toLowerCase() &&
    payload.sessionVersion === user.sessionVersion
  );
}

export function getSessionFromRequest(req: AuthRequestLike): SessionPayload | null {
  let token: string | null = null;
  
  // Si c'est un NextRequest (possède la propriété cookies.get)
  if (req && req.cookies && typeof req.cookies.get === 'function') {
    token = req.cookies.get('nasdash_session')?.value || null;
  } else if (req && typeof req.headers?.get === 'function') {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/nasdash_session=([^;]+)/);
    token = match ? match[1] : null;
  }
  
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = readUsers().find(
    candidate => candidate.username.toLowerCase() === payload.username.toLowerCase()
  );
  if (!user || !isSessionCurrentForUser(payload, user)) return null;

  return {
    ...payload,
    role: user.role,
    allowedTabs: user.allowedTabs || [],
    allowedWidgets: user.allowedWidgets || [],
  };
}

export function isAuthenticated(req: AuthRequestLike): boolean {
  return !!getSessionFromRequest(req);
}

export function isAdmin(req: AuthRequestLike): boolean {
  const payload = getSessionFromRequest(req);
  return payload?.role === 'admin';
}

export function isSecureRequest(req?: AuthRequestLike): boolean {
  const forwardedProto = getRequestHeader(req, 'x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    ?.toLowerCase();
  if (forwardedProto) return forwardedProto === 'https';

  try {
    return new URL(req?.url || '').protocol === 'https:';
  } catch {
    return false;
  }
}

export function verifyCsrf(req: AuthRequestLike): boolean {
  if (!req) return true;
  
  // Only state-changing methods are checked
  let method = '';
  if (typeof req.method === 'string') {
    method = req.method.toUpperCase();
  } else if (req.req && typeof req.req.method === 'string') {
    method = req.req.method.toUpperCase();
  }

  if (!method || ['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  // 1. Sec-Fetch-Site check (extremely robust in modern browsers)
  const getHeader = (name: string) => getRequestHeader(req, name);

  const secFetchSite = getHeader('sec-fetch-site');
  if (secFetchSite && secFetchSite === 'cross-site') {
    console.warn(`CSRF attempt blocked by Sec-Fetch-Site: ${secFetchSite}`);
    return false;
  }

  // 2. Origin/Referer check
  const origin = getHeader('origin');
  const referer = getHeader('referer');
  const host = getHeader('host') || 'localhost';
  
  let targetUrl: URL;
  try {
    const urlStr = req.url || '';
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
      targetUrl = new URL(urlStr);
    } else {
      targetUrl = new URL(urlStr, `http://${host}`);
    }
  } catch {
    return false;
  }

  // Host and port must match: a page served by another service on the same
  // NAS (another port) must not act with this application's cookies. The
  // scheme is not compared, so a TLS proxy that sends no X-Forwarded-Proto
  // keeps working (the browser's Origin is https, the request reaches us in http).
  const allowed = new Set([targetUrl.host.toLowerCase()]);
  try { allowed.add(new URL(`http://${host}`).host.toLowerCase()); }
  catch { return false; }
  const source = origin || referer;
  if (source) {
    try {
      const sourceUrl = new URL(source);
      if (!['http:', 'https:'].includes(sourceUrl.protocol) || sourceUrl.username || sourceUrl.password) return false;
      if (allowed.has(sourceUrl.host.toLowerCase())) return true;
      console.warn(`CSRF attempt blocked: ${sourceUrl.origin} vs ${[...allowed].join(', ')}`);
      return false;
    } catch { return false; }
  }

  return true;
}

export function checkAdmin(req: AuthRequestLike): NextResponse | null {
  if (isDemoMode()) {
    if (!verifyCsrf(req)) {
      return NextResponse.json({ error: 'Validation CSRF échouée.' }, { status: 403 });
    }
    return null;
  }
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'Validation CSRF échouée.' }, { status: 403 });
  }
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }
  return null;
}

// --- GESTION DES UTILISATEURS LOCAUX ---

export function readUsers(options: { failOnError?: boolean } = {}): User[] {
  if (authGlobal.__cachedUsers) {
    return JSON.parse(JSON.stringify(authGlobal.__cachedUsers));
  }

  try {
    const dataDir = path.dirname(USERS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    let fileExists = fs.existsSync(USERS_PATH);
    if (!fileExists) {
      const examplePath = path.join(dataDir, 'users.example.json');
      if (fs.existsSync(examplePath)) {
        try {
          fs.copyFileSync(examplePath, USERS_PATH);
          fileExists = true;
        } catch (e) {
          console.error("Cannot copy users.example.json", e);
        }
      }
    }

    let users: User[] = [];
    if (fileExists) {
      const raw = fs.readFileSync(USERS_PATH, 'utf-8');
      users = JSON.parse(raw);
    }

    const generated: Array<{ username: string; password: string; envName: string }> = [];
    let modified = false;
    for (const user of users) {
      if (!Number.isInteger(user.sessionVersion) || user.sessionVersion < 0) {
        user.sessionVersion = 0;
        modified = true;
      }
    }
    const adminUser = users.find(u => u.username.toLowerCase() === 'admin');
    if (!adminUser) {
      users.push({
        username: 'admin',
        role: 'admin',
        passwordHash: hashPassword(getInitialPassword('admin', generated)),
        allowedTabs: [],
        allowedWidgets: [],
        sessionVersion: 0
      });
      modified = true;
    } else if (adminUser.passwordHash === '__GENERATED_AT_STARTUP__') {
      adminUser.passwordHash = hashPassword(getInitialPassword('admin', generated));
      modified = true;
    }

    // The viewer account is no longer created by itself: it exists when public mode is chosen (its permissions are
    // what anonymous visitors see), see `ensureViewerAccount`. An older template's placeholder still gets a password.
    const viewerUser = users.find(u => u.username.toLowerCase() === 'viewer');
    if (viewerUser?.passwordHash === '__GENERATED_AT_STARTUP__') {
      viewerUser.passwordHash = hashPassword(getInitialPassword('viewer', generated));
      modified = true;
    }

    if (!authGlobal.__warnedAboutDefaultPasswords) {
      const defaultPasswordUsernames = getDefaultPasswordUsernames(users);
      if (defaultPasswordUsernames.includes('admin')) {
        console.warn("[NASDASH] SECURITY WARNING: The admin account still uses the default password \"admin\".");
      }
      if (defaultPasswordUsernames.includes('viewer')) {
        console.warn("[NASDASH] SECURITY WARNING: The viewer account still uses the default password \"viewer\".");
      }
      authGlobal.__warnedAboutDefaultPasswords = true;
    }

    if (modified || !fileExists) {
      safeWriteFileSync(USERS_PATH, JSON.stringify(users, null, 2), { mode: 0o600 });
    }

    // Announce only credentials whose hashes have actually been persisted.
    for (const { username, password, envName } of generated) {
      if (username === 'admin') {
        console.warn('[NASDASH] ─────────────────────────────────────────────');
        console.warn(`[NASDASH] Setup code: ${password}`);
        console.warn('[NASDASH] Open NasDash in a browser and enter this code to create your account.');
        console.warn(`[NASDASH] It works once; set ${envName} instead to choose the first password yourself.`);
        console.warn('[NASDASH] ─────────────────────────────────────────────');
      } else {
        console.warn(`[NASDASH] Initial password generated for ${username}: ${password}`);
        console.warn(`[NASDASH] Log in and change this password immediately (${envName}).`);
      }
    }
    authGlobal.__cachedUsers = JSON.parse(JSON.stringify(users));
    return users;
  } catch (e) {
    console.error("Cannot read users.json", e);
    if (options.failOnError) throw e;
    return [];
  }
}

export function initializeAuthentication(): void {
  if (isDemoMode()) return;
  readUsers({ failOnError: true });
  console.info('[NASDASH] Accounts ready. The setup code is printed only when the administrator account is created; restarting or rebuilding does not reset it.');
}

/**
 * Public mode shows anonymous visitors what the `viewer` account may see: switching to it creates that account when
 * it does not exist (every page and widget, as before; restricted in Settings → Users and access). Its password is
 * random and never printed: an administrator sets one there if someone should sign in as the viewer.
 */
export function ensureViewerAccount(): boolean {
  const users = readUsers();
  if (users.some(user => user.username.toLowerCase() === 'viewer')) return true;
  users.push({ username: 'viewer', role: 'viewer', passwordHash: hashPassword(crypto.randomBytes(24).toString('base64url')), allowedTabs: [], allowedWidgets: [], sessionVersion: 0 });
  return writeUsers(users);
}

export function writeUsers(users: User[]): boolean {
  try {
    const dataDir = path.dirname(USERS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    safeWriteFileSync(USERS_PATH, JSON.stringify(users, null, 2), { mode: 0o600 });
    authGlobal.__cachedUsers = JSON.parse(JSON.stringify(users));
    return true;
  } catch (e) {
    console.error("Cannot write users.json", e);
    return false;
  }
}
