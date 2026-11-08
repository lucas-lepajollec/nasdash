/** Speeds and sizes in the interface language (`Intl` digits, short units). */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
/** Bytes, decimal steps: `512 MB`, `1.2 GB`. */
export function bytes(value: number, locale: string): string {
  let amount = Math.max(0, value), unit = 0;
  while (amount >= 1000 && unit < UNITS.length - 1) { amount /= 1000; unit += 1; }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: amount < 10 && unit ? 1 : 0 }).format(amount)} ${UNITS[unit]}`;
}
/** Bytes per second: `3.4 MB/s`. */
export const byteRate = (value: number, locale: string) => `${bytes(value, locale)}/s`;
/** Bits per second as a line speed: `[value, unit]`, e.g. `['940', 'Mbit/s']` or `['1.2', 'Gbit/s']`. */
export function bitRate(value: number, locale: string): [string, string] {
  const giga = value >= 1e9;
  const amount = giga ? value / 1e9 : value / 1e6;
  return [new Intl.NumberFormat(locale, { maximumFractionDigits: amount < 10 ? 1 : 0 }).format(amount), giga ? 'Gbit/s' : 'Mbit/s'];
}
