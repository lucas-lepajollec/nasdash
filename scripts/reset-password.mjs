import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';

// Local, offline recovery: stop NasDash first so its account cache cannot
// overwrite this update. No HTTP endpoint, environment override or key rotation.
async function readPassword() {
  if (!process.stdin.isTTY) return fs.readFileSync(0, 'utf8').replace(/\r?\n$/, '');
  const hiddenOutput = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const prompt = readline.createInterface({ input: process.stdin, output: hiddenOutput, terminal: true });
  prompt.on('SIGINT', () => { prompt.close(); process.exit(130); });
  try {
    process.stdout.write('New password (at least 12 characters; input hidden): ');
    const password = await prompt.question('');
    process.stdout.write('\nConfirm password (input hidden): ');
    const confirmation = await prompt.question('');
    process.stdout.write('\n');
    if (password !== confirmation) throw new Error('Passwords do not match.');
    return password;
  } finally {
    prompt.close();
  }
}

try {
  if (process.env.NASDASH_DEMO_MODE === 'true') throw new Error('Password recovery is unavailable in demo mode.');
  const username = process.argv[2] || 'admin';
  if (process.argv.length > 3) throw new Error('Usage: node scripts/reset-password.mjs [username]. Supply the password via the hidden prompt or stdin.');
  const file = path.join(path.resolve(process.env.NASDASH_DATA_DIR?.trim() || path.join(process.cwd(), 'data')), 'users.json');
  const users = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(users)) throw new Error('Invalid users.json; no changes made.');
  const matches = users.filter(user => typeof user?.username === 'string' && user.username.toLowerCase() === username.toLowerCase());
  if (matches.length !== 1) throw new Error('Expected exactly one existing account; no changes made.');
  const user = matches[0];
  const version = user.sessionVersion ?? 0;
  if (!Number.isSafeInteger(version) || version < 0 || version === Number.MAX_SAFE_INTEGER) throw new Error('Invalid session version; no changes made.');
  const password = await readPassword();
  if (password.length < 12 || /[\r\n]/.test(password)) throw new Error('Use a password of at least 12 characters on a single line.');
  const salt = crypto.randomBytes(16).toString('hex');
  user.passwordHash = `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  user.sessionVersion = version + 1;
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(users, null, 2), { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    try { fs.unlinkSync(temporary); } catch { /* Already renamed. */ }
  }
  console.info('[NASDASH] Password updated; existing sessions for this account are revoked. Start NasDash again.');
} catch (error) {
  // Do not echo input, file contents, or malformed JSON parser excerpts.
  const message = error instanceof SyntaxError ? 'Invalid users.json; no changes made.' : error.code ? `Recovery failed (${error.code}); check the data mount and permissions.` : error.message;
  console.error(`[NASDASH] ${message}`);
  process.exitCode = 1;
}
