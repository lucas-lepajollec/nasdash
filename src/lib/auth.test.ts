import { describe, it, expect } from 'vitest';
import { 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  verifyToken, 
  verifyCsrf,
  isAdmin,
  isSecureRequest,
  isSessionCurrentForUser
} from './auth';

describe('Auth Utility Tests', () => {
  describe('Password Hashing', () => {
    it('should hash password and verify it correctly', () => {
      const password = 'mySecretPassword123';
      const hash = hashPassword(password);
      expect(hash).toContain(':');
      expect(verifyPassword(password, hash)).toBe(true);
      expect(verifyPassword('wrongPassword', hash)).toBe(false);
    });
  });

  describe('JWT Tokens', () => {
    it('should generate and verify valid tokens', () => {
      const payload = { username: 'testuser', role: 'viewer' as const };
      const token = generateToken(payload);
      expect(token).toBeDefined();

      const verified = verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.username).toBe('testuser');
      expect(verified?.role).toBe('viewer');
      expect(verified?.sessionVersion).toBe(0);
    });

    it('should return null for invalid or expired tokens', () => {
      expect(verifyToken('invalid.token.here')).toBeNull();
    });

    it('should reject a token with a modified signature', () => {
      const token = generateToken({ username: 'admin', role: 'admin' });
      const parts = token.split('.');
      parts[2] = `${parts[2].slice(0, -1)}${parts[2].endsWith('a') ? 'b' : 'a'}`;
      expect(verifyToken(parts.join('.'))).toBeNull();
    });

    it('should carry and validate a non-negative session version', () => {
      const token = generateToken({ username: 'viewer', role: 'viewer', sessionVersion: 4 });
      expect(verifyToken(token)?.sessionVersion).toBe(4);

      const invalidToken = generateToken({ username: 'viewer', role: 'viewer', sessionVersion: -1 });
      expect(verifyToken(invalidToken)).toBeNull();
    });

    it('should revoke a token when the stored session version changes', () => {
      const payload = verifyToken(generateToken({ username: 'viewer', role: 'viewer', sessionVersion: 2 }));
      expect(payload).not.toBeNull();

      const user = {
        username: 'viewer',
        role: 'viewer' as const,
        passwordHash: 'unused:test-hash',
        allowedTabs: [],
        allowedWidgets: [],
        sessionVersion: 3,
      };

      expect(isSessionCurrentForUser(payload!, user)).toBe(false);
      expect(isSessionCurrentForUser({ ...payload!, sessionVersion: 3 }, user)).toBe(true);
    });
  });

  describe('Authorization', () => {
    it('should never grant admin rights without an authenticated admin session', () => {
      const req = { headers: new Map() } as any;
      expect(isAdmin(req)).toBe(false);
    });

    it('should detect HTTPS behind a trusted reverse proxy header', () => {
      const headers = new Map([['x-forwarded-proto', 'https']]);
      expect(isSecureRequest({ headers })).toBe(true);
      expect(isSecureRequest({ url: 'http://localhost' })).toBe(false);
    });
  });

  describe('CSRF Validation', () => {
    it('should allow GET, HEAD, OPTIONS requests without CSRF verification', () => {
      const reqGet = { method: 'GET', url: 'http://localhost/api/test', headers: new Map() } as any;
      expect(verifyCsrf(reqGet)).toBe(true);

      const reqHead = { method: 'HEAD', url: 'http://localhost/api/test', headers: new Map() } as any;
      expect(verifyCsrf(reqHead)).toBe(true);
    });

    it('should block cross-site requests using Sec-Fetch-Site header', () => {
      const headers = new Map();
      headers.set('sec-fetch-site', 'cross-site');
      headers.set('host', 'localhost');
      
      const req = { 
        method: 'POST', 
        url: 'http://localhost/api/test', 
        headers 
      } as any;

      expect(verifyCsrf(req)).toBe(false);
    });

    it('should block requests if Origin does not match target host', () => {
      const headers = new Map();
      headers.set('origin', 'http://malicious-site.com');
      headers.set('host', 'localhost');

      const req = {
        method: 'POST',
        url: 'http://localhost/api/test',
        headers
      } as any;

      expect(verifyCsrf(req)).toBe(false);
    });

    it('should allow requests if Origin matches target host', () => {
      const headers = new Map();
      headers.set('origin', 'http://localhost');
      headers.set('host', 'localhost');

      const req = {
        method: 'POST',
        url: 'http://localhost/api/test',
        headers
      } as any;

      expect(verifyCsrf(req)).toBe(true);
    });

    it('should block requests if Referer does not match target host', () => {
      const headers = new Map();
      headers.set('referer', 'http://malicious-site.com/evil');
      headers.set('host', 'localhost');

      const req = {
        method: 'POST',
        url: 'http://localhost/api/test',
        headers
      } as any;

      expect(verifyCsrf(req)).toBe(false);
    });

    it('should allow requests if Referer matches target host', () => {
      const headers = new Map();
      headers.set('referer', 'http://localhost/dashboard');
      headers.set('host', 'localhost');

      const req = {
        method: 'POST',
        url: 'http://localhost/api/test',
        headers
      } as any;

      expect(verifyCsrf(req)).toBe(true);
    });
  });
});
