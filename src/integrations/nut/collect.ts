import type { IntegrationInstance } from '@/lib/types';
import type { UpsSummary } from '@/lib/widgetData/contracts';
import { ServiceError } from '@/lib/widgetData/services';
import { tcpExchange } from '../ups/socket';

/**
 * Network UPS Tools' own protocol (upsd, TCP 3493): plain text lines, read only. The conversation always ends with
 * LOGOUT, so the server closes it; NasDash never sends INSTCMD, SET or FSD.
 */
const NAME = /^[A-Za-z0-9_.:-]{1,64}$/;

async function conversation(instance: IntegrationInstance, commands: string[]): Promise<string[]> {
  const answer = await tcpExchange(instance, 3493, Buffer.from([...commands, 'LOGOUT', ''].join('\n')), received => /^OK Goodbye/m.test(received.toString('utf8')));
  const lines = answer.toString('utf8').split(/\r?\n/);
  const error = lines.find(line => line.startsWith('ERR '))?.slice(4).trim();
  if (error) throw nutError(error);
  return lines;
}
export function nutError(code: string): ServiceError {
  // upsd allows readers by address: a refusal means NasDash's address is not among them.
  if (/^ACCESS-DENIED/.test(code)) return new ServiceError('widgets.ups.error.denied', 502);
  if (/^UNKNOWN-UPS/.test(code)) return new ServiceError('widgets.ups.error.unknownUps', 404);
  if (/^(DATA-STALE|DRIVER-NOT-CONNECTED)/.test(code)) return new ServiceError('widgets.ups.error.stale', 502);
  return new ServiceError('widgets.error.http', 502);
}

/** `UPS name "description"` lines of LIST UPS. */
export function nutUpsNames(lines: string[]): string[] {
  return lines.map(line => /^UPS (\S+) /.exec(line)?.[1]).filter((name): name is string => !!name && NAME.test(name));
}
/** `VAR ups key "value"` lines of LIST VAR, unescaped. */
export function nutVariables(lines: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of lines) {
    const match = /^VAR \S+ (\S+) "((?:[^"\\]|\\.)*)"$/.exec(line);
    if (match) vars[match[1]] = match[2].replace(/\\(.)/g, '$1');
  }
  return vars;
}

const num = (value: string | undefined) => { const n = value === undefined || !value.trim() ? NaN : Number(value); return Number.isFinite(n) ? n : undefined; };
const text = (value: string | undefined) => value?.trim() ? value.trim().slice(0, 80) : undefined;
const defined = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;

export function toNut(instance: IntegrationInstance, ups: string, vars: Record<string, string>, devices: string[] = []): UpsSummary {
  if (!vars['ups.status'] && vars['battery.charge'] === undefined) throw new ServiceError('widgets.error.parse');
  const flags = new Set((vars['ups.status'] ?? '').toUpperCase().split(/\s+/).filter(Boolean));
  const load = num(vars['ups.load']), nominal = num(vars['ups.realpower.nominal']);
  return {
    provider: 'nut', name: instance.name, ups, ...(devices.length > 1 ? { devices } : {}),
    power: flags.has('OB') ? 'battery' : flags.has('OL') ? 'mains' : 'unknown',
    ...defined({
      model: text(vars['device.model'] ?? vars['ups.model']), manufacturer: text(vars['device.mfr'] ?? vars['ups.mfr']),
      lowBattery: flags.has('LB') || undefined, charging: flags.has('CHRG') || undefined, replaceBattery: flags.has('RB') || undefined,
      overload: flags.has('OVER') || undefined, offline: flags.has('OFF') || undefined,
      batteryPercent: num(vars['battery.charge']), runtimeSeconds: num(vars['battery.runtime']), loadPercent: load,
      // The UPS's own measure, else its share of the rated power.
      loadWatts: num(vars['ups.realpower']) ?? (load !== undefined && nominal ? Math.round(load * nominal / 100) : undefined),
      nominalWatts: nominal, inputVoltage: num(vars['input.voltage']), outputVoltage: num(vars['output.voltage']),
      batteryVoltage: num(vars['battery.voltage']), inputFrequency: num(vars['input.frequency']),
      temperatureC: num(vars['ups.temperature'] ?? vars['battery.temperature']),
    }),
    fetchedAt: Date.now(),
  };
}

export async function nutDevices(instance: IntegrationInstance): Promise<string[]> {
  return nutUpsNames(await conversation(instance, ['LIST UPS']));
}
/** `ups`: the widget's choice; without one, the server's first UPS. */
export async function collectNut(instance: IntegrationInstance, ups?: string): Promise<UpsSummary> {
  if (ups !== undefined && !NAME.test(ups)) throw new ServiceError('widgets.error.invalidSettings', 400);
  const devices = await nutDevices(instance);
  const name = ups ?? devices[0];
  if (!name) throw new ServiceError('widgets.ups.error.noUps', 404);
  return toNut(instance, name, nutVariables(await conversation(instance, [`LIST VAR ${name}`])), devices);
}
