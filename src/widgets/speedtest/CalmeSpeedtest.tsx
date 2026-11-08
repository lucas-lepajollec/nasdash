'use client';

import React from 'react';
import { Gauge, Play } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { SpeedtestSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget, type KitTools } from '@/components/widgets/content/KitWidget';
import { useRelativeTime } from '@/components/widgets/content/kit';
import { bitRate } from '@/components/widgets/content/units';
import { AreaChart, Figure } from '@/components/widgets/media/visual';

/**
 * Speedtest Tracker: the latest test (download, upload, ping), the curve of
 * the recent ones and, for an administrator, a button that starts a test.
 */
export default function CalmeSpeedtest(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<SpeedtestSummary> widget="speedtest" refreshMs={60_000} skeleton={[22, 48, 60]} {...props}
      extraSettings={(draft, change) => (
        <CalmeRow label={t('widgets.speedtest.showChart')}>
          <CalmeSwitch label={t('widgets.speedtest.showChart')} checked={draft.chart !== false} onChange={on => change({ chart: on ? null : false })} />
        </CalmeRow>
      )}>
      {(data, tools) => <Speedtest data={data} tools={tools} chart={props.settings.chart !== false} />}
    </KitWidget>
  );
}

function Speedtest({ data, tools, chart }: { data: SpeedtestSummary; tools: KitTools; chart: boolean }) {
  const { t, locale } = useI18n();
  const ago = useRelativeTime();
  const latest = data.latest;
  const running = data.running || tools.busy === 'run';
  const [down, downUnit] = bitRate(latest?.downloadBps ?? 0, locale);
  const [up, upUnit] = bitRate(latest?.uploadBps ?? 0, locale);
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
  return (
    <div className="ndw-kit">
      <div className="ndw-kit-head">
        <span className={`ndw-kit-state ${latest?.failed ? 'is-bad' : running ? 'is-pending' : ''}`}>
          <Gauge size={13} aria-hidden="true" />
          <span className="ndw-kit-name">{data.name}</span>
          <span className="ndw-kit-word">{running ? t('widgets.speedtest.running') : latest ? (latest.failed ? t('widgets.speedtest.failed') : ago(latest.at)) : ''}</span>
        </span>
        {data.canControl && (
          <button type="button" className="ndc-icon-button" disabled={running} onClick={() => void tools.run('run')} aria-label={t('widgets.speedtest.run')} title={t('widgets.speedtest.run')}>
            {running ? <span className="nd-spinner" style={{ width: 11, height: 11 }} aria-hidden="true" /> : <Play size={12} />}
          </button>
        )}
      </div>
      {!latest ? <span className="ndw-media-sub">{t('widgets.speedtest.none')}</span> : !latest.failed && (
        <div className="ndw-mx-figures is-wrap">
          <Figure size="large" label={t('widgets.speedtest.download')} value={down} unit={downUnit} />
          <Figure size="large" label={t('widgets.speedtest.upload')} value={up} unit={upUnit} />
          <Figure size="medium" tone="muted" label={t('widgets.speedtest.ping')} value={number(latest.pingMs)} unit="ms" />
        </div>
      )}
      {chart && data.history.length > 1 && (
        <div className="ndw-kit-chart">
          <AreaChart values={data.history.map(result => result.downloadBps)} ghost={data.history.map(result => result.uploadBps)} height={56} />
          <span className="ndw-media-sub">{t('widgets.speedtest.recent', { count: data.history.length })}</span>
        </div>
      )}
      {latest?.server && <span className="ndw-media-sub" title={latest.isp}>{latest.server}</span>}
    </div>
  );
}
