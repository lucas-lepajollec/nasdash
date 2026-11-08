'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Gauge, Play } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { SpeedtestResult, SpeedtestSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget, type KitTools } from '@/components/widgets/content/KitWidget';
import { bounded, pick, useRelativeTime } from '@/components/widgets/content/kit';
import { AreaChart, Figure } from '@/components/widgets/media/visual';

const STYLES = ['full', 'compact'] as const;
const UNITS = ['bits', 'bytes'] as const;
const CHARTS = ['speed', 'ping', 'none'] as const;
const COUNTS = ['10', '25'] as const;

/** A line speed in the chosen unit: `['940', 'Mbit/s']`, `['117', 'MB/s']`. */
export function lineSpeed(bitsPerSecond: number, unit: 'bits' | 'bytes', locale: string): [string, string] {
  const value = unit === 'bytes' ? bitsPerSecond / 8 : bitsPerSecond;
  const giga = value >= 1e9;
  const amount = giga ? value / 1e9 : value / 1e6;
  const label = unit === 'bytes' ? (giga ? 'GB/s' : 'MB/s') : (giga ? 'Gbit/s' : 'Mbit/s');
  return [new Intl.NumberFormat(locale, { maximumFractionDigits: amount < 10 ? 1 : 0 }).format(amount), label];
}

/**
 * Speedtest Tracker: the latest test (download, upload, ping, jitter), the
 * curve of the recent ones and, for an administrator, a button that starts a
 * test. Speedtest Tracker measures the line of the machine it runs on.
 */
export default function CalmeSpeedtest(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<SpeedtestSummary> widget="speedtest" refreshMs={60_000} skeleton={[22, 48, 60]} {...props}
      extraSettings={(draft, change) => {
        const compact = pick(draft.style, STYLES, 'full') === 'compact';
        return (
          <>
            <CalmeRow label={t('widgets.display')}>
              <CalmeSegmented label={t('widgets.display')} value={pick(draft.style, STYLES, 'full')} options={STYLES.map(value => ({ value, label: t(`widgets.speedtest.style.${value}`) }))} onChange={value => change({ style: value === 'full' ? null : value })} />
            </CalmeRow>
            <CalmeRow label={t('widgets.speedtest.unit')}>
              <CalmeSegmented label={t('widgets.speedtest.unit')} value={pick(draft.unit, UNITS, 'bits')} options={UNITS.map(value => ({ value, label: value === 'bits' ? 'Mbit/s' : 'MB/s' }))} onChange={value => change({ unit: value === 'bits' ? null : value })} />
            </CalmeRow>
            {!compact && (
              <>
                <CalmeRow label={t('widgets.speedtest.chart')}>
                  <CalmeSegmented label={t('widgets.speedtest.chart')} value={pick(draft.chart === false ? 'none' : draft.chart, CHARTS, 'speed')} options={CHARTS.map(value => ({ value, label: t(`widgets.speedtest.chart.${value}`) }))} onChange={value => change({ chart: value === 'speed' ? null : value })} />
                </CalmeRow>
                {pick(draft.chart === false ? 'none' : draft.chart, CHARTS, 'speed') !== 'none' && (
                  <CalmeRow label={t('widgets.speedtest.count')}>
                    <CalmeSegmented label={t('widgets.speedtest.count')} value={pick(String(draft.count ?? '25'), COUNTS, '25')} options={COUNTS.map(value => ({ value, label: value }))} onChange={value => change({ count: value === '25' ? null : Number(value) })} />
                  </CalmeRow>
                )}
                <CalmeRow label={t('widgets.speedtest.showJitter')}>
                  <CalmeSwitch label={t('widgets.speedtest.showJitter')} checked={draft.jitter === true} onChange={on => change({ jitter: on || null })} />
                </CalmeRow>
                <CalmeRow label={t('widgets.speedtest.showServer')}>
                  <CalmeSwitch label={t('widgets.speedtest.showServer')} checked={draft.server !== false} onChange={on => change({ server: on ? null : false })} />
                </CalmeRow>
              </>
            )}
            <CalmeField label={t('widgets.speedtest.plan')} info={t('widgets.speedtest.planHint')}>
              <input className="nd-input" type="number" inputMode="numeric" min={1} max={100000} placeholder="1000"
                value={typeof draft.plan === 'number' ? draft.plan : ''} onChange={event => { const value = Math.round(Number(event.target.value)); change({ plan: value > 0 && value <= 100_000 ? value : null }); }} />
            </CalmeField>
          </>
        );
      }}>
      {(data, tools) => <Speedtest data={data} tools={tools} settings={props.settings} />}
    </KitWidget>
  );
}

function Speedtest({ data, tools, settings }: { data: SpeedtestSummary; tools: KitTools; settings: WidgetSettings }) {
  const { t, locale } = useI18n();
  const ago = useRelativeTime();
  const latest = data.latest;
  const running = data.running || tools.busy === 'run';
  const unit = pick(settings.unit, UNITS, 'bits');
  const compact = pick(settings.style, STYLES, 'full') === 'compact';
  const chart = pick(settings.chart === false ? 'none' : settings.chart, CHARTS, 'speed');
  const count = bounded(settings.count, 10, 25, 25);
  const plan = typeof settings.plan === 'number' && settings.plan > 0 ? settings.plan * 1e6 : undefined;
  const [down, downUnit] = lineSpeed(latest?.downloadBps ?? 0, unit, locale);
  const [up, upUnit] = lineSpeed(latest?.uploadBps ?? 0, unit, locale);
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
  const share = plan && latest ? new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(latest.downloadBps / plan) : undefined;
  const history = data.history.slice(-count);
  const series = (pickValue: (result: SpeedtestResult) => number) => history.map(pickValue);
  const run = data.canControl && (
    <button type="button" className="ndc-icon-button" disabled={running} onClick={() => void tools.run('run')} aria-label={t('widgets.speedtest.run')} title={t('widgets.speedtest.run')}>
      {running ? <span className="nd-spinner" style={{ width: 11, height: 11 }} aria-hidden="true" /> : <Play size={12} />}
    </button>
  );
  const state = (
    <span className={`ndw-kit-state ${latest?.failed ? 'is-bad' : running ? 'is-pending' : ''}`}>
      <Gauge size={13} aria-hidden="true" />
      <span className="ndw-kit-name">{data.name}</span>
      <span className="ndw-kit-word">{running ? t('widgets.speedtest.running') : latest ? (latest.failed ? t('widgets.speedtest.failed') : ago(latest.at)) : ''}</span>
    </span>
  );

  if (compact) return (
    <div className="ndw-kit ndw-speed is-compact">
      <div className="ndw-kit-head">{state}{run}</div>
      {!latest ? <span className="ndw-media-sub">{t('widgets.speedtest.none')}</span> : !latest.failed && (
        <span className="ndw-speed-line">
          <span title={t('widgets.speedtest.download')}><ArrowDown size={13} aria-hidden="true" />{down}<small>{downUnit}</small></span>
          <span title={t('widgets.speedtest.upload')}><ArrowUp size={13} aria-hidden="true" />{up}<small>{upUnit}</small></span>
          <span className="is-quiet" title={t('widgets.speedtest.ping')}>{number(latest.pingMs)}<small>ms</small></span>
        </span>
      )}
    </div>
  );

  return (
    <div className="ndw-kit ndw-speed">
      <div className="ndw-kit-head">{state}{run}</div>
      {!latest ? <span className="ndw-media-sub">{t('widgets.speedtest.none')}</span> : !latest.failed && (
        <div className="ndw-mx-figures is-wrap">
          <Figure size="large" label={t('widgets.speedtest.download')} value={down} unit={downUnit} />
          <Figure size="large" label={t('widgets.speedtest.upload')} value={up} unit={upUnit} />
          <Figure size="medium" tone="muted" label={t('widgets.speedtest.ping')} value={number(latest.pingMs)} unit="ms" />
          {settings.jitter === true && latest.jitterMs !== undefined && <Figure size="medium" tone="muted" label={t('widgets.speedtest.jitter')} value={number(latest.jitterMs)} unit="ms" />}
        </div>
      )}
      {share && latest && !latest.failed && <span className="ndw-media-sub">{t('widgets.speedtest.ofPlan', { share, plan: lineSpeed(plan!, unit, locale).join(' ') })}</span>}
      {chart !== 'none' && history.length > 1 && (
        <div className="ndw-kit-chart">
          {chart === 'ping'
            ? <AreaChart values={series(result => result.pingMs)} height={56} muted />
            : <AreaChart values={series(result => result.downloadBps)} ghost={series(result => result.uploadBps)} height={56} />}
          <span className="ndw-media-sub">{t(chart === 'ping' ? 'widgets.speedtest.recentPing' : 'widgets.speedtest.recent', { count: history.length })}</span>
        </div>
      )}
      {settings.server !== false && latest?.server && <span className="ndw-media-sub" title={latest.isp}>{[latest.server, latest.isp].filter(Boolean).join(' · ')}</span>}
    </div>
  );
}
