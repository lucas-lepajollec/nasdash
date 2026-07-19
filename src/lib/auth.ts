import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { safeWriteFileSync } from './config';
import { NextResponse } from 'next/server';

const USERS_PATH = path.join(process.cwd(), 'data', 'users.json');
const SECRET_FILE = path.join(process.cwd(), 'data', 'jwt.secret');

// Utiliser une clé persistante ou en générer une nouvelle à chaque démarrage
const globalAny: any = global;

function getJwtSecret(): string {
  let secret = process.env.NASDASH_JWT_SECRET;
  if (!secret) {
    try {
      if (fs.existsSync(SECRET_FILE)) {
        secret = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
      } else {
        secret = crypto.randomBytes(32).toString('hex');
        const dir = path.dirname(SECRET_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        safeWriteFileSync(SECRET_FILE, secret, 'utf-8');
      }
    } catch (e) {
      console.error('Failed to read/write persistent JWT secret:', e);
      if (!globalAny.__jwtSecretFallback) {
        globalAny.__jwtSecretFallback = crypto.randomBytes(32).toString('hex');
      }
      secret = globalAny.__jwtSecretFallback;
    }
  }
  return secret || 'fallback-jwt-secret';
}

if (!globalAny.__jwtSecret) {
  globalAny.__jwtSecret = getJwtSecret();
}
const JWT_SECRET: string = globalAny.__jwtSecret;

if (!globalAny.__cachedUsers) {
  globalAny.__cachedUsers = null;
}

export interface User {
  username: string;
  role: 'admin' | 'viewer';
  passwordHash: string;
  allowedTabs?: string[];
  allowedWidgets?: string[];
}

export interface SessionPayload {
  username: string;
  role: 'admin' | 'viewer';
  allowedTabs?: string[];
  allowedWidgets?: string[];
  exp: number;
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
  } catch (e) {
    return false;
  }
}

// --- SESSION JWT NATIVE ---

export function generateToken(payload: Omit<SessionPayload, 'exp'>, expiresInDays = 30): string {
  const exp = Math.floor(Date.now() / 1000) + (expiresInDays * 24 * 60 * 60);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  
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
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
    
  if (signature !== expectedSignature) {
    return null;
  }
  
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expiré
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: Request | any): SessionPayload | null {
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
  return verifyToken(token);
}

export function isAuthenticated(req: Request | any): boolean {
  return !!getSessionFromRequest(req);
}

export function isAdmin(req: Request | any): boolean {
  const payload = getSessionFromRequest(req);
  if (payload) {
    return payload.role === 'admin';
  }
  
  try {
    const configPath = path.join(process.cwd(), 'data', 'config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);
      const mode = config.settings?.securityMode;
      if (mode === 'private' || mode === 'semi-private') {
        return false;
      }
      return true;
    }
  } catch (e) {
    console.error('Failed to read config in isAdmin check:', e);
  }
  
  return true;
}

export function verifyCsrf(req: Request | any): boolean {
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
  const getHeader = (name: string): string | null => {
    if (req.headers && typeof req.headers.get === 'function') {
      return req.headers.get(name);
    }
    if (req.headers) {
      return req.headers[name] || req.headers[name.toLowerCase()] || null;
    }
    return null;
  };

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

  const hostHeader = host.split(':')[0].toLowerCase();
  const isLocalhost = (h: string) => ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(h.toLowerCase());

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originHost = originUrl.hostname.toLowerCase();
      const targetHost = targetUrl.hostname.toLowerCase();
      
      if (originHost === targetHost || originHost === hostHeader) {
        return true;
      }
      if (isLocalhost(originHost) && (isLocalhost(targetHost) || isLocalhost(hostHeader))) {
        return true;
      }
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(originHost)) {
        return true;
      }
      console.warn(`CSRF attempt blocked by Origin: ${origin} vs target ${targetHost} / host ${hostHeader}`);
      return false;
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererHost = refererUrl.hostname.toLowerCase();
      const targetHost = targetUrl.hostname.toLowerCase();
      
      if (refererHost === targetHost || refererHost === hostHeader) {
        return true;
      }
      if (isLocalhost(refererHost) && (isLocalhost(targetHost) || isLocalhost(hostHeader))) {
        return true;
      }
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(refererHost)) {
        return true;
      }
      console.warn(`CSRF attempt blocked by Referer: ${referer} vs target ${targetHost} / host ${hostHeader}`);
      return false;
    } catch {
      return false;
    }
  }

  return true;
}

export function checkAdmin(req: Request | any): NextResponse | null {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'Validation CSRF échouée.' }, { status: 403 });
  }
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }
  return null;
}

export function checkAuth(req: Request | any): NextResponse | null {
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: 'Validation CSRF échouée.' }, { status: 403 });
  }
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }
  return null;
}


// --- GESTION DES UTILISATEURS LOCAUX ---

export function readUsers(): User[] {
  if (globalAny.__cachedUsers) {
    return JSON.parse(JSON.stringify(globalAny.__cachedUsers));
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
          console.error('Erreur copie users.example.json', e);
        }
      }
    }

    let users: User[] = [];
    if (fileExists) {
      const raw = fs.readFileSync(USERS_PATH, 'utf-8');
      users = JSON.parse(raw);
    }

    let modified = false;
    if (!users.some(u => u.username.toLowerCase() === 'admin')) {
      users.push({
        username: 'admin',
        role: 'admin',
        passwordHash: hashPassword('admin'),
        allowedTabs: [],
        allowedWidgets: []
      });
      modified = true;
    }

    if (!users.some(u => u.username.toLowerCase() === 'viewer')) {
      users.push({
        username: 'viewer',
        role: 'viewer',
        passwordHash: hashPassword('viewer'),
        allowedTabs: [],
        allowedWidgets: []
      });
      modified = true;
    }

    if (modified || !fileExists) {
      safeWriteFileSync(USERS_PATH, JSON.stringify(users, null, 2));
    }

    globalAny.__cachedUsers = JSON.parse(JSON.stringify(users));
    return users;
  } catch (e) {
    console.error('Erreur de lecture du fichier users.json', e);
    return [];
  }
}

export function writeUsers(users: User[]): boolean {
  try {
    const dataDir = path.dirname(USERS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    safeWriteFileSync(USERS_PATH, JSON.stringify(users, null, 2));
    globalAny.__cachedUsers = JSON.parse(JSON.stringify(users));
    return true;
  } catch (e) {
    console.error('Erreur d\'écriture du fichier users.json', e);
    return false;
  }
}
