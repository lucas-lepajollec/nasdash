'use client';

import React from 'react';
import type { HistoryRange } from '@/integrations/history';
import type { Device } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';
import { Emoji } from '@/components/shared/Emoji';
import type { DeviceSnapshot } from './deviceData';
import { uptimeText } from './format';

/**
 * Pieces shared by the Calme device widgets: the default colours, the device
 * header and the 1 h / 24 h switch.
 */

/** One colour per kind of measurement, the same in every widget (see design-calme.css). */
export const KIND_COLOR = {
  cpu: 'var(--ndc-kind-cpu)',
  memory: 'var(--ndc-kind-memory)',
  disk: 'var(--ndc-kind-disk)',
  gpu: 'var(--ndc-kind-gpu)',
  alert: 'var(--ndc-kind-alert)',
} as const;

/** Colours of the lines of a multi-device chart, in order. */
export const SERIES_COLORS = ['var(--ndc-kind-cpu)', 'var(--ndc-kind-memory)', 'var(--ndc-kind-disk)', 'var(--ndc-kind-gpu)', 'var(--ndc-series-5)', 'var(--ndc-series-6)'];

export type DeviceState = 'online' | 'offline' | 'waiting';

export function stateOf(entry: { data?: DeviceSnapshot; failed?: boolean }): DeviceState {
  if (!entry.data) return entry.failed ? 'offline' : 'waiting';
  return entry.data.online ? 'online' : 'offline';
}

/** Name, source and address of a device, with its state and uptime. */
export function DeviceHeader({ device, snapshot, state, showSensitive, compact }: {
  device: Device;
  snapshot?: DeviceSnapshot;
  state: DeviceState;
  showSensitive: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const uptime = uptimeText(snapshot?.vitals.uptimeSeconds, t);
  const details = [device.system, compact ? '' : device.host && (showSensitive ? device.host : '•••')].filter(Boolean).join(' · ');
  const status = state === 'offline' ? t('devices.calme.offline') : state === 'waiting' ? t('devices.calme.waiting') : uptime ? t('devices.calme.onlineSince', { uptime }) : t('devices.calme.online');
  return (
    <div className={`ndc-dev-head ${compact ? 'is-compact' : ''}`}>
      {!compact && <span className="ndc-dev-icon" aria-hidden="true"><Emoji emoji={device.icon || '🖥️'} /></span>}
      <span className="ndc-dev-id">
        <span className="ndc-dev-name">{device.name}</span>
        {(details || compact) && <span className="ndc-dev-sub">{compact ? [device.system, state === 'online' ? uptime : status].filter(Boolean).join(' · ') : details}</span>}
      </span>
      {compact
        ? <span className={`ndc-dot ndc-dev-state--${state}`} title={status} />
        : <span className={`ndc-dev-status ndc-dev-state--${state}`}><span className="ndc-dot" aria-hidden="true" />{status}</span>}
    </div>
  );
}

/** 1 h / 24 h. */
export function RangeSwitch({ value, onChange }: { value: HistoryRange; onChange: (range: HistoryRange) => void }) {
  const { t } = useI18n();
  return (
    <span className="ndc-range" role="group" aria-label={t('devices.calme.range')}>
      {(['1h', '24h'] as const).map(range => (
        <button key={range} type="button" aria-pressed={value === range} className={value === range ? 'is-on' : ''} onClick={() => onChange(range)}>
          {range === '1h' ? t('devices.calme.range1h') : t('devices.calme.range24h')}
        </button>
      ))}
    </span>
  );
}

/** Settings value read as a range. */
export const rangeSetting = (value: unknown): HistoryRange => (value === '24h' ? '24h' : '1h');
