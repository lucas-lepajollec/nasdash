'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { ARR_TYPES, type ArrAppStatus, type ArrStatusResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { IntegrationLogo } from '@/components/integrations/IntegrationLogo';
import { CalmeWidget } from '../calme';
import { DataError, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { ArrSetup, chosenSources, SourcesField, useByteFormat, useConnections } from '@/components/widgets/media/arr';

/**
 * Sonarr, Radarr, Lidarr and Prowlarr at a glance: each app's version,
 * health (its own checks, opened on demand), queue, missing items, free
 * space, or for Prowlarr its indexers.
 */
export default function CalmeArr({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connections = useConnections(ARR_TYPES);
  const sources = chosenSources(connections, settings);
  const { data, error, mutate, stale } = useWidgetData<ArrStatusResponse>('/api/widgets/arr/status', widgetId, settings, { refreshMs: 60_000, isVisible, method: 'GET', enabled: sources.length > 0 });
  const title = t('widget.media-arr.name');
  const issues = data?.apps.reduce((sum, app) => sum + app.health.length + (app.online ? 0 : 1), 0) ?? 0;

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data ? <span className={`ndc-title-note ${issues ? 'ndw-down' : ''}`}>{issues ? t('widgets.arr.issues', { count: issues }) : t('widgets.arr.allHealthy')}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-arr', label: t('widgets.arr.manage') }}>
          {(draft, change) => <SourcesField connections={connections} draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connections.length ? <ArrSetup kind="arr" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 70 }} /></div>
              : <div className="ndw-arr-apps">{data.apps.map(app => <App key={app.id} app={app} />)}</div>}
      </div>
    </CalmeWidget>
  );
}

function App({ app }: { app: ArrAppStatus }) {
  const { t, locale } = useI18n();
  const bytes = useByteFormat();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [open, setOpen] = useState(false);
  const worst = !app.online ? 'error' : app.health.some(item => item.level === 'error') ? 'error' : app.health.length ? 'warning' : 'ok';
  const figures = app.type === 'prowlarr'
    ? [[t('widgets.arr.figure.indexers'), app.indexers], [t('widgets.arr.figure.failing'), app.failingIndexers]]
    : [[t('widgets.arr.figure.queue'), app.queue], [t('widgets.arr.figure.missing'), app.missing]];
  return (
    <section className={`ndw-arr-app is-${worst}`}>
      <header className="ndw-arr-app-head">
        <IntegrationLogo id={app.type} size={26} />
        <span className="ndw-media-row-text">
          <span className="ndw-media-title">{app.name}</span>
          <span className="ndw-media-sub">{app.online ? [app.version && `v${app.version}`, app.freeBytes !== undefined ? t('widgets.arr.free', { size: bytes.size(app.freeBytes) }) : ''].filter(Boolean).join(' · ') : t('widgets.arr.offline')}</span>
        </span>
        <span className="ndw-arr-dot" aria-hidden="true" />
      </header>
      {app.online && (
        <div className="ndw-arr-app-figures">
          {figures.map(([label, value]) => value !== undefined && (
            <span key={String(label)} className="ndw-arr-app-figure"><span className="ndw-arr-app-value">{number.format(Number(value))}</span><span className="ndw-arr-app-label">{label}</span></span>
          ))}
        </div>
      )}
      {app.health.length > 0 && (
        <>
          <button type="button" className="ndw-arr-health-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
            {t('widgets.arr.healthCount', { count: app.health.length })}<ChevronDown size={12} className={open ? 'is-open' : ''} />
          </button>
          {open && <ul className="ndw-arr-health">{app.health.map((item, index) => <li key={index} className={`is-${item.level}`}>{item.message}</li>)}</ul>}
        </>
      )}
    </section>
  );
}
