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
import { Stat } from '@/components/widgets/media/visual';

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
    <CalmeWidget title={title} editMode={editMode} aside={data && issues ? <span className="ndc-title-note">{t('widgets.arr.issues', { count: issues })}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-arr', label: t('widgets.arr.manage') }}>
          {(draft, change) => <SourcesField connections={connections} draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connections.length ? <ArrSetup kind="arr" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 70 }} /></div>
              : <div className="ndw-mx-tiles">{data.apps.map(app => <App key={app.id} app={app} />)}</div>}
      </div>
    </CalmeWidget>
  );
}

function App({ app }: { app: ArrAppStatus }) {
  const { t, locale } = useI18n();
  const bytes = useByteFormat();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [open, setOpen] = useState(false);
  const worst = !app.online ? 'bad' : app.health.some(item => item.level === 'error') ? 'bad' : app.health.length ? 'warn' : 'ok';
  const figures: [string, number | undefined, boolean][] = app.type === 'prowlarr'
    ? [[t('widgets.arr.figure.indexers'), app.indexers, false], [t('widgets.arr.figure.failing'), app.failingIndexers, true]]
    : [[t('widgets.arr.figure.queue'), app.queue, false], [t('widgets.arr.figure.missing'), app.missing, false]];
  return (
    <section className="ndw-mx-tile">
      <header className="ndw-mx-tile-head">
        <IntegrationLogo id={app.type} size={30} bare />
        <span className="ndw-media-row-text">
          <span className="ndw-mx-tile-name">{app.name}</span>
          <span className="ndw-media-sub">{app.online ? (app.version ? t('widgets.arr.versionValue', { version: app.version }) : '') : t('widgets.arr.offline')}</span>
        </span>
        <span className={`ndw-mx-state ${worst === 'ok' ? '' : `is-${worst}`}`}>{worst === 'ok' ? t('widgets.arr.healthy') : !app.online ? t('widgets.arr.offlineShort') : t('widgets.arr.issues', { count: app.health.length })}</span>
      </header>
      {app.online && (
        <div className="ndw-mx-tile-stats">
          {figures.map(([label, value, alarm]) => value !== undefined && <Stat key={label} value={number.format(value)} label={label} tone={value === 0 ? 'muted' : alarm ? 'bad' : undefined} />)}
        </div>
      )}
      {(app.freeBytes !== undefined || app.health.length > 0) && (
        <footer className="ndw-mx-tile-foot">
          {app.freeBytes !== undefined && <span className="ndw-media-sub">{t('widgets.arr.free', { size: bytes.size(app.freeBytes) })}</span>}
          {app.health.length > 0 && (
            <>
              <button type="button" className={`ndw-mx-toggle is-${worst}`} onClick={() => setOpen(!open)} aria-expanded={open}>
                <span className="ndw-mx-toggle-text">{app.health.length === 1 ? app.health[0].message : t('widgets.arr.healthCount', { count: app.health.length })}</span><ChevronDown size={12} className={open ? 'is-open' : ''} />
              </button>
              {open && <ul className="ndw-arr-health">{app.health.map((item, index) => <li key={index} className={`is-${item.level}`}>{item.message}</li>)}</ul>}
            </>
          )}
        </footer>
      )}
    </section>
  );
}
