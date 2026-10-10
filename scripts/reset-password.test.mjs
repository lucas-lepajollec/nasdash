import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('offline account recovery', () => {
  let directory;
  let users;
  const password = 'synthetic-recovery-password';
  const run = (input = password + '\n', args = ['admin'], env = {}) => spawnSync(process.execPath, ['scripts/reset-password.mjs', ...args], {
    input, encoding: 'utf8', env: { ...process.env, NASDASH_DATA_DIR: directory, NASDASH_DEMO_MODE: 'false', ...env },
  });
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-recovery-'));
    users = [{ username: 'admin', role: 'admin', passwordHash: 'old:hash', sessionVersion: 4, allowedTabs: ['dashboard'] }, { username: 'viewer', role: 'viewer', passwordHash: 'unchanged:hash', sessionVersion: 1 }];
    fs.writeFileSync(path.join(directory, 'users.json'), JSON.stringify(users));
    fs.writeFileSync(path.join(directory, 'jwt.secret'), 'synthetic-key-stays-unchanged');
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  it('changes only the selected hash/session version without exposing input or rotating keys', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain(password);
    const updated = JSON.parse(fs.readFileSync(path.join(directory, 'users.json'), 'utf8'));
    const [salt, hash] = updated[0].passwordHash.split(':');
    expect(crypto.scryptSync(password, salt, 64).toString('hex')).toBe(hash);
    expect(updated[0].sessionVersion).toBe(5);
    expect({ ...updated[0], passwordHash: users[0].passwordHash, sessionVersion: 4 }).toEqual(users[0]);
    expect(updated[1]).toEqual(users[1]);
    expect(fs.readFileSync(path.join(directory, 'jwt.secret'), 'utf8')).toBe('synthetic-key-stays-unchanged');
    expect(fs.statSync(path.join(directory, 'users.json')).mode & 0o777).toBe(0o600);
  });
  it.each([
    ['short password', 'short\n', ['admin'], {}],
    ['multiple lines', password + '\nanother-line\n', ['admin'], {}],
    ['missing account', password + '\n', ['missing'], {}],
    ['password in arguments', '', ['admin', password], {}],
    ['demo', password + '\n', ['admin'], { NASDASH_DEMO_MODE: 'true' }],
  ])('rejects %s without changing accounts', (_name, input, args, env) => {
    const before = fs.readFileSync(path.join(directory, 'users.json'), 'utf8');
    const result = run(input, args, env);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(password);
    expect(fs.readFileSync(path.join(directory, 'users.json'), 'utf8')).toBe(before);
  });
  it('preserves malformed accounts without echoing their contents', () => {
    const damaged = '{ "private-test-value": "synthetic-hidden-fragment", malformed }';
    fs.writeFileSync(path.join(directory, 'users.json'), damaged);
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain('synthetic-hidden-fragment');
    expect(fs.readFileSync(path.join(directory, 'users.json'), 'utf8')).toBe(damaged);
  });
});
