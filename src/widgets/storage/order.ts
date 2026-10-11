import type { Reading } from '../devices/readings';

export type StorageOrder = 'host' | 'usage';

/** Existing and new widgets group volumes by host unless fullest-first was selected. */
export const storageOrder = (value: unknown): StorageOrder => value === 'usage' ? 'usage' : 'host';

interface StorageEntry {
  deviceIndex: number;
  reading: Pick<Reading, 'key' | 'label' | 'value'>;
}

/** Host order follows the machine list; volume names and stable keys break ties. */
export function orderStorageEntries<T extends StorageEntry>(entries: readonly T[], order: StorageOrder, locale: string): T[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return [...entries].sort((a, b) => {
    if (order === 'usage') {
      const difference = (b.reading.value ?? 0) - (a.reading.value ?? 0);
      if (difference) return difference;
    }
    return a.deviceIndex - b.deviceIndex
      || collator.compare(a.reading.label, b.reading.label)
      || (a.reading.key < b.reading.key ? -1 : a.reading.key > b.reading.key ? 1 : 0);
  });
}
