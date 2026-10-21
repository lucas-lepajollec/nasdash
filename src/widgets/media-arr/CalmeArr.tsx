'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { ARR_TYPES, type ArrAppStatus, type ArrStatusResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { IntegrationLogo } from '@/components/integrations/IntegrationLogo';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { DataError, pick, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { ArrSetup, chosenSources, SourcesField, useByteFormat, useConnections } from '@/components/widgets/media/arr';
import { Stat, Track } from '@/components/widgets/media/visual';

type Layout = 'tiles' | 'rows';
const LAYOUTS: readonly Layout[] = ['tiles', 'rows'];
interface Parts { figures: boolean; disks: boolean; health: boolean }

/**
 * Sonarr, Radarr, Lidarr and Prowlarr at a glance, as tiles or one row per
 * app: version and state, queue and missing items (Prowlarr: indexers and
 * failing ones), the media folders' free space, and the health checks,
 * folded into a count until opened.
 */
export default function CalmeArr({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const connections = useConnections(ARR_TYPES);
  const sources = chosenSources(connections, settings);
  const { data, error, mutate, stale } = useWidgetData<ArrStatusResponse>('/api/widgets/arr/status', widgetId, settings, { refreshMs: 60_000, isVisible, method: 'GET', enabled: sources.length > 0 });
  const title = t('widget.media-arr.name');
  const layout = pick(settings.layout, LAYOUTS, 'tiles');
  const parts: Parts = { figures: settings.figures !== false, disks: settings.disks !== false, health: settings.health !== false };
  const issues = data?.apps.reduce((sum, app) => sum + app.health.length + (app.online ? 0 : 1), 0) ?? 0;

  return (
    <CalmeWidget title={title} editMode={editMode} aside={data && issues && parts.health ? <span className="ndc-title-note">{t('widgets.arr.issues', { count: issues })}</span> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-arr', label: t('widgets.arr.manage') }}>
          {(draft, change) => (
            <>
              <SourcesField connections={connections} draft={draft} change={change} />
              <CalmeField label={t('widgets.display')}>
                <CalmeSegmented label={t('widgets.display')} value={pick(draft.layout, LAYOUTS, 'tiles')} options={LAYOUTS.map(value => ({ value, label: t(`widgets.arr.layout.${value}`) }))} onChange={value => change({ layout: value === 'tiles' ? null : value })} />
              </CalmeField>
              {(['figures', 'disks', 'health'] as const).map(part => (
                <CalmeRow key={part} label={t(`widgets.arr.part.${part}`)} info={part === 'disks' ? t('widgets.arr.part.disksHint') : undefined}>
                  <CalmeSwitch label={t(`widgets.arr.part.${part}`)} checked={draft[part] !== false} onChange={on => change({ [part]: on ? null : false })} />
                </CalmeRow>
              ))}
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connections.length ? <ArrSetup kind="arr" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 70 }} /></div>
              : layout === 'rows'
                ? <div className="ndw-mx-applist">{data.apps.map(app => <AppRow key={app.id} app={app} parts={parts} />)}</div>
                : <div className="ndw-mx-tiles">{data.apps.map(app => <AppTile key={app.id} app={app} parts={parts} />)}</div>}
      </div>
    </CalmeWidget>
  );
}

/** How the app is: healthy, its number of issues, or offline. */
function useAppState(app: ArrAppStatus, issues = true): { tone: 'ok' | 'warn' | 'bad'; word: string } {
  const { t } = useI18n();
  if (!app.online) return { tone: 'bad', word: t('widgets.arr.offlineShort') };
  // Health checks hidden: the app reads healthy unless it is unreachable.
  if (!issues) return { tone: 'ok', word: t('widgets.arr.healthy') };
  if (!app.health.length) return { tone: 'ok', word: t('widgets.arr.healthy') };
  return { tone: app.health.some(item => item.level === 'error') ? 'bad' : 'warn', word: t('widgets.arr.issues', { count: app.health.length }) };
}

function useFigures(app: ArrAppStatus): [string, number | undefined, boolean][] {
  const { t } = useI18n();
  return app.type === 'prowlarr'
    ? [[t('widgets.arr.figure.indexers'), app.indexers, false], [t('widgets.arr.figure.failing'), app.failingIndexers, true]]
    : [[t('widgets.arr.figure.queue'), app.queue, false], [t('widgets.arr.figure.missing'), app.missing, false]];
}

function AppTile({ app, parts }: { app: ArrAppStatus; parts: Parts }) {
  const { t, locale } = useI18n();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const state = useAppState(app, parts.health);
  const figures = useFigures(app);
  return (
    <section className="ndw-mx-tile">
      <header className="ndw-mx-tile-head">
        <IntegrationLogo id={app.type} size={30} bare />
        <span className="ndw-media-row-text">
          <span className="ndw-mx-tile-name">{app.name}</span>
          <span className="ndw-media-sub">{app.online ? (app.version ? t('widgets.arr.versionValue', { version: app.version }) : '') : t('widgets.arr.offline')}</span>
        </span>
        <span className={`ndw-mx-state ${state.tone === 'ok' ? '' : `is-${state.tone}`}`}>{state.word}</span>
      </header>
      {parts.figures && app.online && (
        <div className="ndw-mx-statrow">
          {figures.map(([label, value, alarm]) => value !== undefined && <Stat key={label} value={number.format(value)} label={label} tone={value === 0 ? 'muted' : alarm ? 'bad' : undefined} />)}
        </div>
      )}
      {parts.disks && !!app.roots?.length && <Roots roots={app.roots} />}
      {parts.health && app.health.length > 0 && <Health app={app} tone={state.tone} />}
    </section>
  );
}

function AppRow({ app, parts }: { app: ArrAppStatus; parts: Parts }) {
  const { t, locale } = useI18n();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const state = useAppState(app, parts.health);
  const figures = useFigures(app);
  const bytes = useByteFormat();
  const free = app.roots?.length ? Math.min(...app.roots.map(root => root.freeBytes)) : undefined;
  return (
    <section className="ndw-mx-approw">
      <div className="ndw-mx-approw-main">
        <IntegrationLogo id={app.type} size={24} bare />
        <span className="ndw-mx-tile-name">{app.name}</span>
        {parts.figures && app.online && (
          <span className="ndw-mx-approw-figures">
            {figures.map(([label, value, alarm]) => value !== undefined && <span key={label} className={value === 0 ? 'is-muted' : alarm ? 'is-bad' : ''}><b>{number.format(value)}</b> {label}</span>)}
          </span>
        )}
        {parts.disks && free !== undefined && <span className="ndw-media-time">{t('widgets.arr.free', { size: bytes.size(free) })}</span>}
        <span className={`ndw-mx-state ${state.tone === 'ok' ? '' : `is-${state.tone}`}`}>{state.word}</span>
      </div>
      {parts.health && app.health.length > 0 && <Health app={app} tone={state.tone} />}
    </section>
  );
}

/** Each media folder: its name, free space and how full it is. */
function Roots({ roots }: { roots: NonNullable<ArrAppStatus['roots']> }) {
  const { t } = useI18n();
  const bytes = useByteFormat();
  return (
    <div className="ndw-mx-roots">
      {roots.map(root => (
        <div key={root.name} className="ndw-mx-root">
          <span className="ndw-mx-root-head">
            <span className="ndw-mx-root-name">{root.name}</span>
            <span className="ndw-media-time">{root.totalBytes ? t('widgets.arr.freeOf', { size: bytes.size(root.freeBytes), total: bytes.size(root.totalBytes) }) : t('widgets.arr.free', { size: bytes.size(root.freeBytes) })}</span>
          </span>
          {!!root.totalBytes && <Track thin value={(1 - root.freeBytes / root.totalBytes) * 100} tone={root.freeBytes / root.totalBytes < 0.1 ? 'warn' : 'muted'} />}
        </div>
      ))}
    </div>
  );
}

/** The health checks: a count, then the messages when opened. */
function Health({ app, tone }: { app: ArrAppStatus; tone: 'ok' | 'warn' | 'bad' }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="ndw-mx-health">
      <button type="button" className={`ndw-mx-health-toggle is-${tone}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        {t('widgets.arr.healthCount', { count: app.health.length })}<ChevronDown size={12} className={open ? 'is-open' : ''} />
      </button>
      {open && (
        <ul className="ndw-mx-health-list">
          {app.health.map((item, index) => <li key={index} className={`is-${item.level}`}>{item.message}</li>)}
        </ul>
      )}
    </div>
  );
}
