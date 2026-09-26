'use client';

import React, { useState } from 'react';
import type { Device } from '@/lib/types';
import type { WidgetSettings } from '@/lib/pages/types';
import { SlidersHorizontal } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { useConfig } from '@/hooks/useConfig';
import { CalmeDialog, CalmeCheckRow, CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import CustomSelect from '@/components/shared/CustomSelect';
import { ColorDialog, ColorSwatch, DialogPortal } from './ColorDialog';
import {
  CHART_SIZES, CHART_STYLES, DISPLAYS, FACETS, fitDisplay, lookSettings, METRIC_INFO, readLook, SIZED, VALUE_PARTS,
  type ChartLook, type Display, type Facet, type LookDefaults, type MetricId, type ValuePart, type WidgetLook,
} from './look';
import { SERIES_COLORS } from './parts';
import { useDevicesData } from './deviceData';
import { readingsOf } from './readings';

type Translate = (key: string, variables?: Record<string, string | number>) => string;

export function metricName(metric: MetricId, t: Translate): string {
  switch (metric) {
    case 'cpu': return 'CPU';
    case 'memory': return 'RAM';
    case 'gpu': return 'GPU';
    case 'temperature': return t('devices.calme.temperature');
    case 'load': return t('devices.calme.load');
    case 'network': return t('devices.calme.network');
    case 'disk': return t('devices.calme.sectionDisks');
    case 'history': return t('devices.look.history');
  }
}

export function displayName(display: Display, t: Translate): string {
  return t(display === 'value' ? 'devices.look.displayValue' : display === 'bar' ? 'devices.look.displayBar' : display === 'ring' ? 'devices.look.displayRing' : 'devices.look.displayChart');
}

export interface DeviceDialogOptions {
  title: string;
  devices: Device[];
  /** `single`: one machine (Device); `multi`: several (Fleet, charts, one-measure widgets). */
  deviceMode: 'single' | 'multi';
  /** Settings key holding the chosen machines. */
  deviceKey: 'deviceId' | 'deviceIds' | 'selectedDeviceIds';
  defaults: LookDefaults;
  /** A one-measure widget: the measure is always shown (no check box). */
  single?: boolean;
  /** Offer the default period (widgets with charts). */
  range?: boolean;
  /** Offer the display formats (the machines chart only draws charts). */
  displays?: boolean;
  /** One-measure widgets: a colour per machine instead of per measure. */
  deviceColors?: boolean;
}

function facetName(facet: Facet, t: Translate): string {
  switch (facet) {
    case 'temperature': return t('devices.calme.temperature');
    case 'load': return t('devices.calme.load');
    case 'vram': return t('devices.look.vram');
    case 'upload': return t('devices.calme.sent');
    case 'averages': return t('devices.look.averages');
    case 'cores': return t('devices.look.cores');
    case 'part': return t('devices.look.part');
  }
}

function partName(part: ValuePart, t: Translate): string {
  return t(part === 'percent' ? 'devices.look.formatPercent' : part === 'used' ? 'devices.look.formatUsed' : part === 'free' ? 'devices.look.formatFree' : 'devices.look.formatTotal');
}

/** Chart type and height, shown when a measure (or all of them) is drawn as a chart. */
function ChartOptions({ value, onChange }: { value: ChartLook; onChange: (chart: ChartLook) => void }) {
  const { t } = useI18n();
  return (
    <div className="ndc-dlg-chart">
      <CalmeSegmented
        label={t('devices.calme.chartStyle')}
        value={value.style}
        options={CHART_STYLES.map(style => ({ value: style, label: t(style === 'line' ? 'devices.calme.chartLine' : style === 'area' ? 'devices.calme.chartArea' : 'devices.calme.chartBars') }))}
        onChange={style => onChange({ ...value, style })}
      />
      <CalmeSegmented
        label={t('devices.calme.height')}
        value={value.size}
        options={CHART_SIZES.map(size => ({ value: size, label: t(size === 'small' ? 'devices.calme.heightSmall' : size === 'medium' ? 'devices.calme.heightMedium' : 'devices.calme.heightLarge') }))}
        onChange={size => onChange({ ...value, size })}
      />
    </div>
  );
}

/**
 * Settings of a device widget, in a real dialog: the machines (with their
 * colour in one-measure widgets), the measures (shown, display, chart type
 * and height, colour, danger threshold), one display for all or one per
 * measure, the extra figures of one-measure widgets, the danger colour and
 * the default period. Nothing is saved until "Save"; colours open their own
 * small picker.
 */
export function DeviceWidgetDialog({ options, settings, onSave, onClose }: {
  options: DeviceDialogOptions;
  settings: WidgetSettings;
  onSave: (settings: WidgetSettings) => void;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const [draft, setDraft] = useState<WidgetSettings>(settings);
  const [picking, setPicking] = useState<{ kind: 'metric'; id: MetricId } | { kind: 'device'; id: string; index: number } | { kind: 'danger' } | null>(null);
  const change = (patch: WidgetSettings) => setDraft(current => ({ ...current, ...patch }));
  const look = readLook(draft, options.defaults);
  const setLook = (update: (look: WidgetLook) => WidgetLook) => change(lookSettings(update(look)));
  const setMetric = (id: MetricId, patch: Partial<WidgetLook['metrics'][MetricId]>) => setLook(current => ({ ...current, metrics: { ...current.metrics, [id]: { ...current.metrics[id], ...patch } } }));
  const { devices } = options;
  const single = options.single ? options.defaults.offered[0] : null;
  // One-measure widgets and "same for all" use the widget's display and chart options.
  const shared = !!single || !look.perMetricDisplay;

  // Machines: one (radio) or several (all when nothing is chosen).
  const chosen = options.deviceMode === 'single'
    ? [typeof draft.deviceId === 'string' && devices.some(device => device.id === draft.deviceId) ? draft.deviceId : devices[0]?.id].filter(Boolean) as string[]
    : Array.isArray(draft[options.deviceKey]) ? (draft[options.deviceKey] as string[]).filter(id => devices.some(device => device.id === id)) : devices.map(device => device.id);
  // What the chosen machines actually report: the other measures are flagged.
  const readings = useDevicesData(chosen, '1h');
  const loaded = chosen.some(id => readings[id]?.data);
  const reported = (id: MetricId) => id === 'history'
    ? chosen.some(device => readingsOf(readings[device]?.data, 'cpu', t, language).length > 0)
    : chosen.some(device => readingsOf(readings[device]?.data, id, t, language).length > 0);
  const toggleDevice = (id: string) => {
    if (options.deviceMode === 'single') { change({ deviceId: id }); return; }
    const next = chosen.includes(id) ? chosen.filter(item => item !== id) : [...chosen, id];
    change({ [options.deviceKey]: next.length === devices.length ? null : devices.filter(device => next.includes(device.id)).map(device => device.id) });
  };
  const deviceColor = (id: string, index: number) => look.deviceColors[id] ?? (single && look.metrics[single].display === 'chart' ? SERIES_COLORS[index % SERIES_COLORS.length] : single ? look.metrics[single].color : 'var(--ndc-kind-cpu)');

  const setShared = (display: Display) => setLook(current => ({
    ...current, display,
    metrics: single ? { ...current.metrics, [single]: { ...current.metrics[single], display: fitDisplay(single, display), ownDisplay: fitDisplay(single, display) } } : current.metrics,
  }));
  const sharedDisplay = single ? look.metrics[single].display : look.display;
  // The default period only matters when something is drawn as a chart.
  const usesCharts = options.defaults.offered.some(id => look.metrics[id].shown && (look.metrics[id].display === 'chart' || id === 'history'));
  const { setDeviceModal } = useConfig();
  // A machine's own settings: the changes made here are kept, then its dialog opens.
  const openDevice = (device: Device) => {
    if (JSON.stringify(draft) !== JSON.stringify(settings)) onSave(draft);
    onClose();
    setDeviceModal({ open: true, device });
  };

  return (
    <DialogPortal onClose={onClose}>
      {ref => (
        <CalmeDialog
          dialogRef={ref}
          label={options.title}
          title={options.title}
          onClose={onClose}
          width={620}
          footer={<>
            <button type="button" className="nd-btn" onClick={onClose}>{t('Annuler')}</button>
            <button type="button" className="nd-btn nd-btn-accent" onClick={() => { onSave(draft); onClose(); }}>{t('Enregistrer')}</button>
          </>}
        >
          {devices.length > 0 && (
            <CalmeField label={options.deviceMode === 'single' ? t('devices.calme.machine') : t('devices.calme.machines')} info={options.deviceColors ? t('devices.look.deviceColorsHint') : undefined}>
              <div className="ndc-dlg-list">
                {devices.map((device, index) => (
                  <div key={device.id} className="ndc-dlg-device">
                    <CalmeCheckRow checked={chosen.includes(device.id)} onChange={() => toggleDevice(device.id)}>
                      <span className="ndc-dlg-name">{device.name}</span>
                      {device.system && <span className="ndc-dlg-note">{device.system}</span>}
                    </CalmeCheckRow>
                    {options.deviceColors && <ColorSwatch color={deviceColor(device.id, index)} label={[t('devices.look.color'), device.name].join(' · ')} onClick={() => setPicking({ kind: 'device', id: device.id, index })} />}
                    <button type="button" className="ndc-icon-button ndc-dlg-device-edit" onClick={() => openDevice(device)} title={t('devices.look.deviceSettings', { name: device.name })} aria-label={t('devices.look.deviceSettings', { name: device.name })}>
                      <SlidersHorizontal size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </CalmeField>
          )}

          {options.displays !== false && (
            <CalmeField label={t('devices.look.display')} info={single ? undefined : t('devices.look.displayHint')}>
              <div className="ndc-dlg-stack">
                {!single && (
                  <CalmeSegmented
                    label={t('devices.look.display')}
                    value={look.perMetricDisplay ? 'each' : 'all'}
                    options={[{ value: 'all', label: t('devices.look.sameForAll') }, { value: 'each', label: t('devices.look.perMetric') }]}
                    onChange={value => setLook(current => ({ ...current, perMetricDisplay: value === 'each' }))}
                  />
                )}
                {shared && (
                  <CalmeSegmented
                    label={t('devices.look.display')}
                    value={sharedDisplay}
                    options={(single ? METRIC_INFO[single].displays : DISPLAYS).map(display => ({ value: display, label: displayName(display, t) }))}
                    onChange={setShared}
                  />
                )}
                {shared && sharedDisplay === 'chart' && <ChartOptions value={look.chart} onChange={chart => setLook(current => ({ ...current, chart }))} />}
              </div>
            </CalmeField>
          )}

          {single && ((FACETS[single]?.length ?? 0) > 0 || SIZED.includes(single)) && (
            <CalmeField label={t('devices.look.shownValues')} info={t('devices.look.shownValuesHint')}>
              <div className="ndc-dlg-stack">
                {SIZED.includes(single) && VALUE_PARTS.map(part => (
                  <CalmeCheckRow
                    key={part}
                    checked={look.valueParts.includes(part)}
                    onChange={() => setLook(current => {
                      const next = current.valueParts.includes(part) ? current.valueParts.filter(item => item !== part) : [...current.valueParts, part];
                      // Something is always shown.
                      return next.length ? { ...current, valueParts: VALUE_PARTS.filter(item => next.includes(item)) } : current;
                    })}
                  >
                    <span className="ndc-dlg-name">{partName(part, t)}</span>
                  </CalmeCheckRow>
                ))}
                {(FACETS[single] ?? []).map(facet => (
                  <CalmeCheckRow key={facet} checked={look.facets.includes(facet)} onChange={() => setLook(current => ({ ...current, facets: current.facets.includes(facet) ? current.facets.filter(item => item !== facet) : [...current.facets, facet] }))}>
                    <span className="ndc-dlg-name">{facetName(facet, t)}</span>
                  </CalmeCheckRow>
                ))}
              </div>
            </CalmeField>
          )}

          <CalmeRow label={t('devices.look.dangerAlerts')} info={t('devices.look.dangerAlertsHint')}>
            <CalmeSwitch label={t('devices.look.dangerAlerts')} checked={!look.dangerOff} onChange={on => setLook(current => ({ ...current, dangerOff: !on }))} />
          </CalmeRow>

          <CalmeField label={single ? t('devices.look.dangerThreshold') : t('devices.look.measures')} info={single ? t('devices.look.dangerHint') : t('devices.look.measuresHint')}>
            <div className="ndc-dlg-metrics">
              {options.defaults.offered.map(id => {
                const metric = look.metrics[id];
                const info = METRIC_INFO[id];
                const eachDisplay = !shared && info.displays.length > 1;
                return (
                  <div key={id} className={`ndc-dlg-metric-block ${metric.shown || single ? '' : 'is-off'}`}>
                    <div className="ndc-dlg-metric">
                      {single
                        ? <span className="ndc-dlg-name">{metricName(id, t)}{loaded && !reported(id) && <span className="ndc-dlg-missing">{t('devices.look.notReported')}</span>}</span>
                        : <CalmeCheckRow checked={metric.shown} onChange={() => setMetric(id, { shown: !metric.shown })}><span className="ndc-dlg-name">{metricName(id, t)}{loaded && !reported(id) && <span className="ndc-dlg-missing" title={t('devices.look.notReportedHint')}>{t('devices.look.notReported')}</span>}</span></CalmeCheckRow>}
                      {eachDisplay ? (
                        <div className="ndc-dlg-select">
                          <CustomSelect
                            ariaLabel={[metricName(id, t), t('devices.look.display')].join(' · ')}
                            value={metric.ownDisplay}
                            options={info.displays.map(display => ({ value: display, label: displayName(display, t) }))}
                            onChange={value => { const display = fitDisplay(id, value as Display); setMetric(id, { display, ownDisplay: display }); }}
                          />
                        </div>
                      ) : <span />}
                      {!options.deviceColors ? <ColorSwatch color={metric.color} label={[t('devices.look.color'), metricName(id, t)].join(' · ')} onClick={() => setPicking({ kind: 'metric', id })} /> : <span />}
                      {info.dangerRange && !look.dangerOff ? (
                        <label className="ndc-dlg-danger" title={t('devices.look.dangerHint')}>
                          <span className="ndc-dlg-danger-label">{t('devices.look.dangerAt')}</span>
                          <input
                            className="nd-input"
                            type="number"
                            inputMode="decimal"
                            min={info.dangerRange.min}
                            max={info.dangerRange.max}
                            step={info.dangerRange.step}
                            value={metric.danger ?? ''}
                            placeholder={t('devices.look.none')}
                            onChange={event => {
                              const raw = event.target.value;
                              const value = raw === '' ? null : Math.min(info.dangerRange!.max, Math.max(info.dangerRange!.min, Number(raw)));
                              setMetric(id, { danger: value === null || Number.isFinite(value) ? value : metric.danger });
                            }}
                          />
                          <span className="ndc-dlg-unit">{info.unit}</span>
                        </label>
                      ) : <span />}
                    </div>
                    {!shared && metric.shown && metric.display === 'chart' && id !== 'history' && (
                      <ChartOptions value={metric.chart} onChange={chart => setMetric(id, { chart, ownChart: chart })} />
                    )}
                  </div>
                );
              })}
            </div>
          </CalmeField>

          {!look.dangerOff && (
            <CalmeField label={t('devices.look.dangerColor')} info={t('devices.look.dangerColorHint')}>
              <div className="ndc-dlg-inline">
                <ColorSwatch color={look.dangerColor} label={t('devices.look.dangerColor')} onClick={() => setPicking({ kind: 'danger' })} />
                <span className="ndc-dlg-note">{look.customDangerColor ?? t('devices.look.defaultColor')}</span>
              </div>
            </CalmeField>
          )}

          {options.range && usesCharts && (
            <CalmeField label={t('devices.calme.defaultRange')}>
              <CalmeSegmented
                label={t('devices.calme.defaultRange')}
                value={draft.range === '24h' ? '24h' : '1h'}
                options={[{ value: '1h', label: t('devices.calme.range1h') }, { value: '24h', label: t('devices.calme.range24h') }]}
                onChange={value => change({ range: value })}
              />
            </CalmeField>
          )}

          {picking && (
            <ColorDialog
              title={picking.kind === 'danger' ? t('devices.look.dangerColor') : [t('devices.look.color'), picking.kind === 'metric' ? metricName(picking.id, t) : devices.find(device => device.id === picking.id)?.name ?? ''].join(' · ')}
              value={picking.kind === 'danger' ? look.customDangerColor : picking.kind === 'metric' ? look.metrics[picking.id].customColor : look.deviceColors[picking.id] ?? null}
              fallback={picking.kind === 'danger' ? 'var(--ndc-kind-alert)' : picking.kind === 'metric' ? METRIC_INFO[picking.id].color : deviceColor(picking.id, picking.index)}
              onPick={color => {
                if (picking.kind === 'danger') setLook(current => ({ ...current, customDangerColor: color, dangerColor: color ?? 'var(--ndc-kind-alert)' }));
                else if (picking.kind === 'metric') setMetric(picking.id, { customColor: color, color: color ?? METRIC_INFO[picking.id].color });
                else setLook(current => {
                  const deviceColors = { ...current.deviceColors };
                  if (color) deviceColors[picking.id] = color; else delete deviceColors[picking.id];
                  return { ...current, deviceColors };
                });
              }}
              onClose={() => setPicking(null)}
            />
          )}
        </CalmeDialog>
      )}
    </DialogPortal>
  );
}
