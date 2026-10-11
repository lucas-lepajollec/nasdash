import { describe, expect, it } from 'vitest';
import { orderStorageEntries, storageOrder } from './order';

const entries = [
  { deviceIndex: 0, reading: { key: 'disk:/volume10', label: 'volume10', value: 66 } },
  { deviceIndex: 1, reading: { key: 'disk:/', label: '/', value: 58 } },
  { deviceIndex: 0, reading: { key: 'disk:/volume2', label: 'volume2', value: 31 } },
  { deviceIndex: 0, reading: { key: 'disk:/', label: '/', value: 3 } },
];
const keys = (rows: typeof entries) => rows.map(row => `${row.deviceIndex}:${row.reading.key}`);

describe('Storage volume order', () => {
  it('defaults missing and unsupported saved options to host grouping', () => {
    expect(storageOrder(undefined)).toBe('host');
    expect(storageOrder('invalid')).toBe('host');
    expect(storageOrder('usage')).toBe('usage');
  });

  it('groups hosts in machine order, then sorts volume names naturally', () => {
    expect(keys(orderStorageEntries(entries, 'host', 'en-US'))).toEqual([
      '0:disk:/', '0:disk:/volume2', '0:disk:/volume10', '1:disk:/',
    ]);
    expect(entries[0].reading.label).toBe('volume10');
  });

  it('keeps host order unchanged when readings cross during a refresh', () => {
    const refreshed = entries.map(entry => ({ ...entry, reading: { ...entry.reading, value: 100 - entry.reading.value } }));
    expect(keys(orderStorageEntries(refreshed, 'host', 'en-US'))).toEqual(keys(orderStorageEntries(entries, 'host', 'en-US')));
  });

  it('offers the original global fullest-first order', () => {
    expect(keys(orderStorageEntries(entries, 'usage', 'en-US'))).toEqual([
      '0:disk:/volume10', '1:disk:/', '0:disk:/volume2', '0:disk:/',
    ]);
  });

  it('breaks equal labels and usage ties with the stable volume key', () => {
    const sameName = [
      { deviceIndex: 0, reading: { key: 'disk:/b/data', label: 'data', value: 42 } },
      { deviceIndex: 0, reading: { key: 'disk:/a/data', label: 'data', value: 42 } },
    ];
    expect(keys(orderStorageEntries(sameName, 'usage', 'en-US'))).toEqual(['0:disk:/a/data', '0:disk:/b/data']);
    expect(orderStorageEntries([], 'host', 'en-US')).toEqual([]);
  });
});
