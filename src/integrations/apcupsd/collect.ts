import type { IntegrationInstance } from '@/lib/types';
import type { UpsSummary } from '@/lib/widgetData/contracts';
import { ServiceError } from '@/lib/widgetData/services';
import { tcpExchange } from '../ups/socket';

/**
 * apcupsd's network information server (TCP 3551): one `status` request, answered by records each prefixed with
 * their length on two bytes, closed by an empty record. It has no command to change anything.
 */
const frame = (text: string) => { const body = Buffer.from(text); return Buffer.concat([Buffer.from([body.length >> 8, body.length & 255]), body]); };

/** The records of a complete answer, or undefined while the closing empty record has not arrived. */
export function apcRecords(received: Buffer): string[] | undefined {
  const records: string[] = [];
  for (let at = 0; at + 2 <= received.length;) {
    const size = received.readUInt16BE(at);
    if (size === 0) return records;
    if (at + 2 + size > received.length) return undefined;
    records.push(received.subarray(at + 2, at + 2 + size).toString('utf8'));
    at += 2 + size;
  }
  return undefined;
}
/** `KEY      : value` lines. */
export function apcFields(records: string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of records.join('').split(/\r?\n/)) {
    const match = /^([A-Z0-9 ]+?)\s*:\s?(.*)$/.exec(line);
    if (match) fields[match[1].trim()] = match[2].trim();
  }
  return fields;
}

/** `"87.0 Percent"` → 87; `"42.5 Minutes"` → 2550 with `unit: 'seconds'`. */
function measure(value: string | undefined, unit?: 'seconds'): number | undefined {
  const match = /^(-?\d+(?:\.\d+)?)\s*([A-Za-z]*)/.exec(value ?? '');
  if (!match) return undefined;
  const n = Number(match[1]);
  if (unit !== 'seconds') return n;
  return /^min/i.test(match[2]) ? Math.round(n * 60) : /^hour/i.test(match[2]) ? Math.round(n * 3600) : n;
}
const text = (value: string | undefined) => value && value !== 'N/A' ? value.slice(0, 80) : undefined;
const defined = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;

export function toApcupsd(instance: IntegrationInstance, fields: Record<string, string>): UpsSummary {
  if (!fields.STATUS) throw new ServiceError('widgets.error.parse');
  const status = fields.STATUS.toUpperCase();
  const load = measure(fields.LOADPCT), nominal = measure(fields.NOMPOWER);
  const onBattery = measure(fields.TONBATT, 'seconds');
  return {
    provider: 'apcupsd', name: instance.name,
    power: /\bONBATT\b/.test(status) ? 'battery' : /\bONLINE\b/.test(status) ? 'mains' : 'unknown',
    ...defined({
      ups: text(fields.UPSNAME), model: text(fields.MODEL), manufacturer: /^APC\b/.test(fields.MODEL ?? '') ? 'APC' : undefined,
      lowBattery: /\bLOWBATT\b/.test(status) || undefined, replaceBattery: /\bREPLACEBATT\b/.test(status) || undefined,
      overload: /\bOVERLOAD\b/.test(status) || undefined, offline: /\bCOMMLOST\b/.test(status) || undefined,
      batteryPercent: measure(fields.BCHARGE), runtimeSeconds: measure(fields.TIMELEFT, 'seconds'), loadPercent: load,
      shutdownPercent: measure(fields.MBATTCHG), shutdownRuntimeSeconds: measure(fields.MINTIMEL, 'seconds'),
      loadWatts: load !== undefined && nominal ? Math.round(load * nominal / 100) : undefined, nominalWatts: nominal,
      inputVoltage: measure(fields.LINEV), outputVoltage: measure(fields.OUTPUTV), batteryVoltage: measure(fields.BATTV),
      inputFrequency: measure(fields.LINEFREQ), temperatureC: measure(fields.ITEMP),
      lastTransfer: text(fields.LASTXFER), transfers: measure(fields.NUMXFERS), onBatterySeconds: onBattery ? onBattery : undefined,
    }),
    fetchedAt: Date.now(),
  };
}

export async function collectApcupsd(instance: IntegrationInstance): Promise<UpsSummary> {
  const answer = await tcpExchange(instance, 3551, frame('status'), received => apcRecords(received) !== undefined);
  return toApcupsd(instance, apcFields(apcRecords(answer) ?? []));
}
