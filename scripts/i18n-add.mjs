#!/usr/bin/env node
/**
 * Adds interface messages to the five dictionaries of `src/i18n/messages.ts`
 * at once (part of the integration kit, also usable alone):
 *
 *   node scripts/i18n-add.mjs messages.json [--replace]
 *
 * `messages.json` maps each key to its five texts, in the order
 * en, fr, es, de, it (an array) or by language (an object). Keys that already
 * exist are left as they are, unless `--replace` is given. `npm run check:i18n`
 * then checks every language has every key with the same placeholders.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LANGUAGES = ['en', 'fr', 'es', 'de', 'it'];
const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/i18n-add.mjs messages.json [--replace]');
  process.exit(1);
}
const replace = flags.includes('--replace');
const target = join(process.cwd(), 'src/i18n/messages.ts');
const input = JSON.parse(readFileSync(file, 'utf8'));

const entries = Object.entries(input).map(([key, value]) => {
  const texts = Array.isArray(value) ? value : LANGUAGES.map(language => value?.[language]);
  if (texts.length !== LANGUAGES.length || texts.some(text => typeof text !== 'string' || !text.trim())) {
    throw new Error(`${key}: five non-empty texts are needed (${LANGUAGES.join(', ')}).`);
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(key)) throw new Error(`${key}: keys use letters, digits, dots, dashes and underscores.`);
  return [key, texts];
});

let source = readFileSync(target, 'utf8');
const keyPattern = key => new RegExp(`^  ['"]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]: .*$`, 'm');
let added = 0, replaced = 0, kept = 0;
LANGUAGES.forEach((language, index) => {
  const start = source.indexOf(`const ${language}: Dictionary = {`);
  if (start < 0) throw new Error(`Dictionary ${language} not found in src/i18n/messages.ts.`);
  const end = source.indexOf('\n};', start);
  let body = source.slice(start, end);
  const lines = [];
  for (const [key, texts] of entries) {
    const line = `  '${key}': ${JSON.stringify(texts[index])},`;
    const pattern = keyPattern(key);
    if (pattern.test(body)) {
      if (replace) { body = body.replace(pattern, line); if (!index) replaced += 1; }
      else if (!index) kept += 1;
    } else {
      lines.push(line);
      if (!index) added += 1;
    }
  }
  source = `${source.slice(0, start)}${body}${lines.length ? `\n${lines.join('\n')}` : ''}${source.slice(end)}`;
});
writeFileSync(target, source);
console.log(`${added} added, ${replaced} replaced, ${kept} already present (left as they are).`);
