import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const USERS_PATH = path.join(process.cwd(), 'data', 'users.json');

// Utiliser une clé persistante ou en générer une nouvelle à chaque démarrage
const globalAny: any = global;
if (!globalAny.__jwtSecret) {
  globalAny.__jwtSecret = process.env.NASDASH_JWT_SECRET || crypto.randomBytes(32).toString('hex');
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
  return payload?.role === 'admin';
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

    let users: User[] = [];
    let fileExists = fs.existsSync(USERS_PATH);

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
      fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
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
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
    globalAny.__cachedUsers = JSON.parse(JSON.stringify(users));
    return true;
  } catch (e) {
    console.error('Erreur d\'écriture du fichier users.json', e);
    return false;
  }
}
