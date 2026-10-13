import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeFileTransaction } from './fileTransaction';
const directories: string[] = [];
afterEach(() => { vi.restoreAllMocks(); directories.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })); });
function fixture() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-transaction-')); directories.push(dir); return [path.join(dir, 'config.json'), path.join(dir, 'services.json')]; }
describe('multi-file configuration writes', () => {
  it('does not replace config when another target is a directory', () => {
    const [config, services] = fixture(); fs.writeFileSync(config, 'original'); fs.mkdirSync(services);
    expect(() => writeFileTransaction([[config, 'new'], [services, 'new']])).toThrow();
    expect(fs.readFileSync(config, 'utf8')).toBe('original');
    expect(fs.readdirSync(path.dirname(config)).sort()).toEqual(['config.json', 'services.json']);
  });
  it('rolls back already committed files when a later rename fails', () => {
    const [config, services] = fixture(); fs.writeFileSync(config, 'original-config'); fs.writeFileSync(services, 'original-services');
    const rename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => { if (String(from).endsWith('.tmp') && to === services) throw new Error('Injected failure'); rename(from, to); });
    expect(() => writeFileTransaction([[config, 'new'], [services, 'new']])).toThrow('Injected failure');
    expect(fs.readFileSync(config, 'utf8')).toBe('original-config'); expect(fs.readFileSync(services, 'utf8')).toBe('original-services');
  });
});
