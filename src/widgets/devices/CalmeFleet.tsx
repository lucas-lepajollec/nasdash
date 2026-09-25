'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import type { Device } from '@/lib/types';
import type { WidgetSettings } from '@/lib/pages/types';
import { useI18n } from '@/i18n/I18nProvider';
import { useConfig } from '@/hooks/useConfig';
import { useWidgetSize } from '@/components/widgets/WidgetContainer';
import { WidgetHeaderActions } from '@/components/widgets/WidgetHeaderActions';
import { CalmeWidget } from '../calme';
import { latestTime, useDevicesData, type DeviceSnapshot } from './deviceData';
import { uptimeText } from './format';
import { isDanger, readLook, type LookDefaults, type MetricId, type WidgetLook } from './look';
import { MetricView } from './MetricView';
import { readingsOf, type Reading } from './readings';
import { stateOf, type DeviceState } from './parts';
import { SettingsButton } from './SettingsButton';

export const FLEET_DEFAULTS: LookDefaults = {
  offered: ['cpu', 'memory', 'gpu', 'temperature', 'load', 'network', 'disk'],
  shown: ['cpu', 'memory', 'temperature'],
  display: 'bar',
  perMetricDisplay: true,
  displays: { cpu: 'bar', memory: 'bar', gpu: 'bar', temperature: 'value', load: 'value', network: 'value', disk: 'bar' },
};

/** Width a measure needs in a row, by display. */
const CELL_PX = { value: 56, bar: 72, ring: 76, chart: 84 } as const;
const NAME_PX = 120;

/**
 * Every machine on one line: state, name, then its measures in their
 * displays (bars, figures, small rings or trends). When the measures do not
 * fit beside the name, they wrap under it. A machine past one of its danger
 * thresholds gets the danger colour on its dot. Offline machines are dimmed.
 * Replaces the historical Devices widget under Calme and keeps its choice of
 * devices (`selectedDeviceIds`).
 */
export default function CalmeFleet({ devices, settings, editMode, isVisible, onUpdateSettings }: {
  devices: Device[];
  settings: WidgetSettings;
  editMode: boolean;
  isVisible: boolean;
  onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { setDeviceModal } = useConfig();
  const { width } = useWidgetSize();
  const selected = Array.isArray(settings.selectedDeviceIds) ? (settings.selectedDeviceIds as string[]) : null;
  const shown = selected ? devices.filter(device => selected.includes(device.id)) : devices;
  const data = useDevicesData(shown.map(device => device.id), '1h', isVisible);
  const online = shown.filter(device => stateOf(data[device.id] ?? {}) === 'online').length;
  const look = readLook(settings, FLEET_DEFAULTS);
  const metrics = FLEET_DEFAULTS.offered.filter(id => look.metrics[id].shown);
  const needed = NAME_PX + metrics.reduce((sum, id) => sum + CELL_PX[look.metrics[id].display] + 12, 0) + 32;
  const stacked = width < needed;

  return (
    <CalmeWidget
      title={t('devices.calme.fleet')}
      editMode={editMode}
      flush
      aside={shown.length > 0 && <span className="ndc-title-note">{t('devices.calme.onlineCount', { online, total: shown.length })}</span>}
    >
      {editMode && (
        <WidgetHeaderActions>
          <button type="button" className="nd-action-icon accent" onClick={() => setDeviceModal({ open: true })} title={t('devices.calme.add')} aria-label={t('devices.calme.add')}><Plus size={13} /></button>
        </WidgetHeaderActions>
      )}
      {editMode && (
        <SettingsButton
          options={{ title: t('devices.look.settingsOf', { name: t('devices.calme.fleet') }), devices, deviceMode: 'multi', deviceKey: 'selectedDeviceIds', defaults: FLEET_DEFAULTS }}
          settings={settings}
          onSave={onUpdateSettings}
        />
      )}
      {shown.length === 0 ? (
        <div className="ndc-empty">{t('devices.calme.noDevice')}</div>
      ) : (
        <div className={`ndc-fleet ${stacked ? 'is-stacked' : ''}`}>
          {shown.map(device => {
            const entry = data[device.id] ?? {};
            const row = <FleetRow device={device} snapshot={entry.data} state={stateOf(entry)} look={look} metrics={metrics} stacked={stacked} />;
            return editMode ? (
              <button key={device.id} type="button" className="ndc-fleet-edit" onClick={() => setDeviceModal({ open: true, device })} title={t('devices.calme.edit')}>{row}</button>
            ) : <React.Fragment key={device.id}>{row}</React.Fragment>;
          })}
        </div>
      )}
    </CalmeWidget>
  );
}

/** One reading per measure in a row: the fullest disk, the first GPU. */
function rowReading(snapshot: DeviceSnapshot | undefined, metric: MetricId, t: (key: string, variables?: Record<string, string | number>) => string, language: Parameters<typeof readingsOf>[3]): Reading | undefined {
  const readings = readingsOf(snapshot, metric, t, language);
  if (metric === 'disk') return [...readings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  return readings[0];
}

function FleetRow({ device, snapshot, state, look, metrics, stacked }: { device: Device; snapshot?: DeviceSnapshot; state: DeviceState; look: WidgetLook; metrics: MetricId[]; stacked: boolean }) {
  const { t, language } = useI18n();
  const uptime = uptimeText(snapshot?.vitals.uptimeSeconds, t);
  const sub = state === 'offline' ? t('devices.calme.offline') : [device.system, uptime].filter(Boolean).join(' · ');
  const readings = state === 'online' ? metrics.map(id => ({ id, reading: rowReading(snapshot, id, t, language) })) : [];
  const alarm = readings.some(({ id, reading }) => reading && isDanger(look, id, reading.value, reading.cores));
  const end = latestTime(snapshot);
  const window = { start: end - 3_600_000, end, withSeconds: true };
  return (
    <div className={`ndc-fleet-row ${state === 'offline' ? 'is-offline' : ''}`}>
      <span className="ndc-fleet-id">
        <span className={`ndc-dot ndc-dev-state--${state}`} style={alarm ? { background: look.dangerColor } : undefined} aria-hidden="true" />
        <span className="ndc-fleet-text">
          <span className="ndc-fleet-name" title={device.name}>{device.name}</span>
          {sub && <span className="ndc-fleet-sub">{sub}</span>}
        </span>
      </span>
      <span className="ndc-fleet-metrics" style={{ gridTemplateColumns: stacked ? 'repeat(auto-fill, minmax(76px, 1fr))' : metrics.map(id => `minmax(${CELL_PX[look.metrics[id].display]}px, 1fr)`).join(' ') }}>
        {metrics.map(id => {
          const reading = readings.find(item => item.id === id)?.reading;
          return reading
            ? <MetricView key={id} reading={reading} look={look} display={look.metrics[id].display} window={window} size="small" inline />
            : <span key={id} className="ndc-m ndc-m--empty" aria-hidden="true" />;
        })}
      </span>
    </div>
  );
}
