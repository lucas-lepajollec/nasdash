import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function readOrCreatePersistentSecret(filePath: string): string {
  if (fs.existsSync(filePath)) {
    const storedSecret = fs.readFileSync(filePath, 'utf8').trim();
    if (storedSecret) return storedSecret;
  }

  const secret = crypto.randomBytes(32).toString('hex');
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, secret, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } catch {}
    throw error;
  }

  return secret;
}
