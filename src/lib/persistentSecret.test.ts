import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { readOrCreatePersistentSecret } from './persistentSecret';

function withTemporaryDirectory(run: (directory: string) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-secret-'));
  try {
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe('persistent local secrets', () => {
  it('keeps an existing non-empty secret unchanged', () => {
    withTemporaryDirectory(directory => {
      const secretPath = path.join(directory, 'jwt.secret');
      fs.writeFileSync(secretPath, 'existing-secret\n', 'utf8');

      expect(readOrCreatePersistentSecret(secretPath)).toBe('existing-secret');
      expect(fs.readFileSync(secretPath, 'utf8')).toBe('existing-secret\n');
    });
  });

  it('creates one strong secret and reuses it', () => {
    withTemporaryDirectory(directory => {
      const secretPath = path.join(directory, 'jwt.secret');
      const generated = readOrCreatePersistentSecret(secretPath);

      expect(generated).toMatch(/^[0-9a-f]{64}$/);
      expect(readOrCreatePersistentSecret(secretPath)).toBe(generated);
      expect(fs.readdirSync(directory)).toEqual(['jwt.secret']);
    });
  });

  it('replaces an empty secret file instead of using a predictable value', () => {
    withTemporaryDirectory(directory => {
      const secretPath = path.join(directory, 'encryption.key');
      fs.writeFileSync(secretPath, '', 'utf8');

      const generated = readOrCreatePersistentSecret(secretPath);

      expect(generated).toMatch(/^[0-9a-f]{64}$/);
      expect(fs.readFileSync(secretPath, 'utf8')).toBe(generated);
    });
  });
});
