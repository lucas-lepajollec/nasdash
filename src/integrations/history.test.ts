import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pruneHistory, readHistory, recordSamples, resetHistory, samplesOf, saveHistory, setHistoryFile } from './history';
import { demoDeviceHistory } from '@/lib/demoDevices';

const MINUTE = 60_000;
const start = Date.UTC(2026, 8, 25, 12, 0, 0);

afterEach(() => { resetHistory(); setHistoryFile(null); });

describe('device history', () => {
  it('turns a poll into series (percentages, temperatures, network, load)', () => {
    expect(samplesOf(
      [{ key: 'cpu.usage', kind: 'cpu', percent: 104, temperatureC: 51 }, { key: 'disk.usage:/data', kind: 'disk', percent: 40 }],
      { netRxBps: 1200, netTxBps: 300, load: [0.5, 0.4, 0.3] },
    )).toEqual({ 'cpu.usage': 100, 'cpu.usage@temp': 51, 'disk.usage:/data': 40, 'net.rx': 1200, 'net.tx': 300, 'load.1': 0.5 });
  });

  it('keeps every poll for an hour and one averaged point with its peak per minute for a day', () => {
    for (let i = 0; i < 12; i++) recordSamples('nas', { 'cpu.usage': i % 2 ? 30 : 10 }, start + i * 10_000);
    const hour = readHistory('nas', '1h');
    expect(hour['cpu.usage']).toHaveLength(12);
    const day = readHistory('nas', '24h');
    // Minute 1 is finished, minute 2 is still being accumulated: both are returned.
    expect(day['cpu.usage']).toEqual([[start, 20, 30], [start + MINUTE, 20, 30]]);
  });

  it('drops points older than the range', () => {
    recordSamples('nas', { 'cpu.usage': 5 }, start);
    recordSamples('nas', { 'cpu.usage': 7 }, start + 2 * 60 * MINUTE);
    expect(readHistory('nas', '1h')['cpu.usage']).toEqual([[start + 2 * 60 * MINUTE, 7]]);
    recordSamples('nas', { 'cpu.usage': 9 }, start + 25 * 60 * MINUTE);
    expect(readHistory('nas', '24h')['cpu.usage'].map(point => point[0])).not.toContain(start);
  });

  it('returns only newer points with `since`', () => {
    for (let i = 0; i < 5; i++) recordSamples('nas', { 'cpu.usage': i }, start + i * 10_000);
    expect(readHistory('nas', '1h', start + 20_000)['cpu.usage']).toEqual([[start + 30_000, 3], [start + 40_000, 4]]);
  });

  it('forgets removed devices', () => {
    recordSamples('old', { 'cpu.usage': 1 }, start);
    recordSamples('nas', { 'cpu.usage': 1 }, start);
    pruneHistory(['nas']);
    expect(readHistory('old', '1h')).toEqual({});
    expect(readHistory('nas', '1h')['cpu.usage']).toHaveLength(1);
  });

  it('saves the day and reads it back after a restart', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nd-history-')), 'metrics-history.json');
    setHistoryFile(file);
    const now = Date.now();
    recordSamples('nas', { 'cpu.usage': 10 }, now - 3 * MINUTE);
    recordSamples('nas', { 'cpu.usage': 20 }, now - MINUTE);
    saveHistory(true);
    resetHistory();
    setHistoryFile(file);
    expect(readHistory('nas', '24h')['cpu.usage']?.[0]?.[1]).toBe(10);
  });

  it('gives the demo moving, repeatable curves', () => {
    const now = start;
    const first = demoDeviceHistory('demo-device-1', '1h', 0, now);
    expect(first['cpu.usage'].length).toBeGreaterThan(300);
    expect(new Set(first['cpu.usage'].map(point => point[1])).size).toBeGreaterThan(20);
    expect(demoDeviceHistory('demo-device-1', '1h', 0, now)).toEqual(first);
    expect(demoDeviceHistory('demo-device-1', '24h', 0, now)['net.rx'].every(point => point[1] >= 0)).toBe(true);
  });
});
