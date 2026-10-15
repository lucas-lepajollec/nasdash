'use client';

import React, { useMemo, useState } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { DnsSummary, DnsTopEntry } from '@/lib/widgetData/contracts';
import { demoFetch } from '@/lib/demoTransport';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField, CalmeCheckRow } from '@/components/shared/CalmeDialog';
import { CalmeSegmented } from '@/components/modals/settings/shared/CalmeControls';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { TimeChart, type ChartSeries } from '@/components/charts/TimeChart';
import { RingGauge } from '@/components/charts/Gauges';
import { CalmeWidget } from '../calme';
import { bounded, chartHeight, DataError, pick, useBoxWidth, useWidgetData, WidgetDataError, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';

export type DnsStyle = 'bars' | 'chart' | 'ring' | 'compact' | 'full';
const STYLES: readonly DnsStyle[] = ['bars', 'chart', 'ring', 'compact', 'full'];
type Section = 'stats' | 'history' | 'top';
const SECTIONS: readonly Section[] = ['stats', 'history', 'top'];
export type DnsFigure = 'queries' | 'blocked' | 'share' | 'listed' | 'clients';
const FIGURES: readonly DnsFigure[] = ['queries', 'blocked', 'share', 'listed', 'clients'];
/** Chosen figures in their fixed order; without a choice, what each style shows by default. */
export function figuresOf(settings: WidgetSettings, style: DnsStyle): DnsFigure[] {
  if (Array.isArray(settings.figures)) return FIGURES.filter(id => (settings.figures as unknown[]).includes(id));
  return style === 'full' ? ['queries', 'blocked', 'listed', 'clients'] : style === 'ring' ? ['queries', 'blocked'] : ['queries', 'blocked', 'share'];
}
type TopList = 'topBlocked' | 'topClients' | 'topQueried';
const TOPS: readonly TopList[] = ['topBlocked', 'topClients', 'topQueried'];
/** Pause choices, in seconds (0: until resumed). */
const PAUSES = [300, 1800, 3600, 0] as const;
const BLOCKED = 'var(--nd-red)';
const QUERIES = 'var(--nd-accent)';

/**
 * A Pi-hole or AdGuard Home in four styles: complete (share blocked as a
 * ring, figures, the day as a chart, top lists), chart, ring alone, and a
 * compact line. The block's width decides the chart height and whether
 * parts sit side by side. An admin can pause blocking or resume it.
 */
export default function CalmeDns({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const connection = chosenConnection(config?.integrations, ['pihole', 'adguard'], settings.integrationId);
  const style = pick(settings.style, STYLES, 'bars');
  const { data, error, mutate } = useWidgetData<DnsSummary>('/api/widgets/dns', widgetId, settings, { refreshMs: 15_000, isVisible, method: 'GET', enabled: !!connection });
  const title = t('widget.dns.name');
  const [ref, width] = useBoxWidth<HTMLDivElement>();

  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} width={620} shared={{ tab: 'widget-dns', label: t('widgets.dns.manage') }}>
          {(draft, change) => <DnsSettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div ref={ref} className="ndw-dns-box">
        {!connection ? (settings.integrationId ? <div className="ndc-empty ndc-empty--error">{t('widgets.dns.connectionGone')}</div> : <SetupGuide kind="dns" />)
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" /><span className="ndw-skeleton-row" style={{ height: 90 }} /><span className="ndw-skeleton-row" /></div>
              : <DnsBody data={data} style={style} width={width} settings={settings} widgetId={widgetId} onChanged={next => void mutate(next, { revalidate: false })} />}
      </div>
    </CalmeWidget>
  );
}

function useNumbers() {
  const { locale } = useI18n();
  return useMemo(() => ({
    full: new Intl.NumberFormat(locale),
    short: new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }),
    percent: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
  }), [locale]);
}

function DnsBody({ data, style, width, settings, widgetId, onChanged }: {
  data: DnsSummary; style: DnsStyle; width: number; settings: WidgetSettings; widgetId: string; onChanged: (summary: DnsSummary) => void;
}) {
  const { t } = useI18n();
  const number = useNumbers();
  const sections = Array.isArray(settings.sections) ? SECTIONS.filter(section => (settings.sections as unknown[]).includes(section)) : [...SECTIONS];
  const topCount = bounded(settings.topCount, 3, 10, 5);
  const head = <DnsHead data={data} settings={settings} widgetId={widgetId} onChanged={onChanged} />;
  const share = `${number.percent.format(data.blockedPercent)}`;
  // The figures this widget shows (its choice, else what suits the style), in a fixed order.
  const shown = figuresOf(settings, style);
  const all: Record<DnsFigure, React.ReactNode> = {
    queries: <Figure key="queries" label={t('widgets.dns.queries')} value={number.short.format(data.queries)} title={number.full.format(data.queries)} />,
    blocked: <Figure key="blocked" label={t('widgets.dns.blocked')} value={number.short.format(data.blocked)} title={number.full.format(data.blocked)} tone="blocked" />,
    share: <Figure key="share" label={t('widgets.dns.blockedShare')} value={`${share} %`} />,
    listed: data.listedDomains === undefined ? null : <Figure key="listed" label={t('widgets.dns.listed')} value={number.short.format(data.listedDomains)} title={number.full.format(data.listedDomains)} />,
    clients: data.clients === undefined ? null : <Figure key="clients" label={t('widgets.dns.clients')} value={number.full.format(data.clients)} />,
  };
  const figures = shown.map(id => all[id]);

  if (style === 'bars') {
    return (
      <div className="ndw-dns-bars-style">
        {head}
        {figures.some(Boolean) && <div className="ndw-dns-figures">{figures}</div>}
        {data.history.length > 1 && <DnsBars data={data} height={chartHeight(width, 0.18, 56, 120)} />}
      </div>
    );
  }

  if (style === 'compact') {
    // Minimal: the share blocked, what it is made of, one thin proportion line.
    return (
      <div className="ndw-dns-compact">
        {head}
        <div className="ndw-dns-compact-line">
          <span className="ndw-dns-big">{share}<small>%</small></span>
          <span className="ndw-dns-compact-text">{t('widgets.dns.blockedOf', { blocked: number.short.format(data.blocked), queries: number.short.format(data.queries) })}</span>
        </div>
        <span className="ndw-dns-share-line" aria-hidden="true"><span style={{ width: `${Math.min(100, data.blockedPercent)}%` }} /></span>
      </div>
    );
  }

  if (style === 'ring') {
    const size = Math.round(Math.min(190, Math.max(110, width * 0.42)));
    return (
      <div className="ndw-dns-ring">
        {head}
        <RingGauge percent={data.blockedPercent} color={BLOCKED} label={t('widgets.dns.blockedShort')} size={size} text={share} unit="%" />
        <div className="ndw-dns-ring-legend">
          {shown.includes('queries') && <span><i style={{ background: QUERIES }} />{t('widgets.dns.queriesCount', { count: number.short.format(data.queries) })}</span>}
          {shown.includes('blocked') && <span><i style={{ background: BLOCKED }} />{t('widgets.dns.blockedCount', { count: number.short.format(data.blocked) })}</span>}
        </div>
      </div>
    );
  }

  if (style === 'chart') {
    return (
      <div className="ndw-dns-chart-style">
        {head}
        {figures.some(Boolean) && <div className="ndw-dns-figures">{figures}</div>}
        <DnsChart data={data} height={chartHeight(width, 0.36, 120, 300)} narrow={width < 240} />
      </div>
    );
  }

  // Complete: wide blocks put the figures beside the chart and the three lists side by side.
  const wide = width >= 620;
  const lists = width >= 760;
  return (
    <div className={`ndw-dns-full ${wide ? 'is-wide' : ''}`}>
      {head}
      <div className="ndw-dns-main">
        {sections.includes('stats') && (
          <div className="ndw-dns-hero">
            <RingGauge percent={data.blockedPercent} color={BLOCKED} label={t('widgets.dns.blockedShort')} size={wide ? 104 : 88} text={share} unit="%" />
            <div className="ndw-dns-figures ndw-dns-figures--stack">
              {figures}
            </div>
          </div>
        )}
        {sections.includes('history') && data.history.length > 1 && (
          <div className="ndw-dns-chart"><DnsChart data={data} height={wide ? 150 : chartHeight(width, 0.34, 110, 200)} narrow={width < 240} /></div>
        )}
      </div>
      {sections.includes('top') && <DnsTops data={data} count={topCount} columns={lists} />}
    </div>
  );
}

function Figure({ label, value, title, tone }: { label: string; value: string; title?: string; tone?: 'blocked' }) {
  return (
    <div className={`ndw-dns-figure ${tone ? `is-${tone}` : ''}`} title={title}>
      <span className="ndw-dns-figure-value">{value}</span>
      <span className="ndw-dns-figure-label">{label}</span>
    </div>
  );
}

/** Status and, for an admin, pause/resume with a duration menu. */
function DnsHead({ data, settings, widgetId, onChanged }: { data: DnsSummary; settings: WidgetSettings; widgetId: string; onChanged: (summary: DnsSummary) => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const toggle = async (blocking: boolean, durationSeconds?: number) => {
    setBusy(true); setMenu(false); setActionError(null);
    try {
      const response = await demoFetch('/api/widgets/dns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetId, blocking, ...(durationSeconds ? { durationSeconds } : {}), ...(user?.role === 'admin' ? { draft: settings } : {}) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new WidgetDataError(payload?.error || 'widgets.error.network', response.status);
      onChanged(payload as DnsSummary);
    } catch (cause) {
      setActionError(cause instanceof WidgetDataError ? cause.key : 'widgets.error.network');
    } finally { setBusy(false); }
  };
  const resumesIn = data.blockingResumesAt ? Math.max(1, Math.round((data.blockingResumesAt - Date.now()) / 60_000)) : undefined;
  const state = data.blocking ? t('widgets.dns.protected') : resumesIn ? t('widgets.dns.pausedFor', { minutes: resumesIn }) : t('widgets.dns.paused');
  // A quiet line: the server, its state as a dot and a word; an admin gets a real switch.
  return (
    <div className="ndw-dns-head">
      <span className={`ndw-dns-status ${data.blocking ? 'is-on' : 'is-off'}`} title={state}>
        {data.blocking ? <ShieldCheck size={13} className="ndw-dns-shield" aria-hidden="true" /> : <ShieldOff size={13} className="ndw-dns-shield" aria-hidden="true" />}
        <span className="ndw-dns-server">{data.name}</span>
        <span className="ndw-dns-state">{state}</span>
      </span>
      {user?.role === 'admin' && (
        <span className="ndw-dns-control">
          {busy && <span className="nd-spinner" style={{ width: 11, height: 11 }} aria-hidden="true" />}
          <button
            type="button"
            role="switch"
            aria-checked={data.blocking}
            aria-label={data.blocking ? t('widgets.dns.pause') : t('widgets.dns.resume')}
            title={data.blocking ? t('widgets.dns.pause') : t('widgets.dns.resume')}
            className="ndc-switch-button"
            disabled={busy}
            onClick={() => (data.blocking ? setMenu(!menu) : void toggle(true))}
          >
            <span className={`ndc-switch ${data.blocking ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
          </button>
          {menu && (
            <span className="ndw-dns-menu" role="menu">
              <span className="ndw-dns-menu-title">{t('widgets.dns.pause')}</span>
              {PAUSES.map(seconds => (
                <button key={seconds} type="button" role="menuitem" onClick={() => void toggle(false, seconds || undefined)}>
                  {seconds ? t('widgets.dns.pauseFor', { minutes: seconds / 60 }) : t('widgets.dns.pauseIndefinitely')}
                </button>
              ))}
            </span>
          )}
        </span>
      )}
      {actionError && <p className="ndw-note ndw-down" role="alert">{t(actionError)}</p>}
    </div>
  );
}

/** The day as hourly bars, the blocked share at the foot of each; the hovered hour is told underneath. */
function DnsBars({ data, height }: { data: DnsSummary; height: number }) {
  const { t, locale } = useI18n();
  const number = useNumbers();
  const [hovered, setHovered] = useState<number | null>(null);
  const hour = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);
  const bars = useMemo(() => hourly(data.history), [data.history]);
  const max = Math.max(1, ...bars.map(bar => bar[1]));
  const shown = hovered === null ? null : bars[hovered];
  return (
    <figure className="ndw-dns-barchart" aria-label={t('widgets.dns.history')} onPointerLeave={() => setHovered(null)}>
      <div className="ndw-dns-barrow" style={{ height }}>
        {bars.map(([time, total, blocked], index) => (
          <span key={time} className={`ndw-dns-bar ${hovered === index ? 'is-hovered' : ''}`} onPointerEnter={() => setHovered(index)}>
            <span className="ndw-dns-bar-fill" style={{ height: `${Math.max(3, (total / max) * 100)}%` }}>
              <span className="ndw-dns-bar-blocked" style={{ height: `${total ? (blocked / total) * 100 : 0}%` }} />
            </span>
          </span>
        ))}
      </div>
      <figcaption className="ndw-dns-barcaption">
        {shown
          ? <span>{hour.format(shown[0])} · {t('widgets.dns.queriesCount', { count: number.full.format(shown[1]) })} · <span className="ndw-down">{t('widgets.dns.blockedCount', { count: number.full.format(shown[2]) })}</span></span>
          : <><span>{t('widgets.dns.dayAgo')}</span><span>{t('devices.calme.now')}</span></>}
      </figcaption>
    </figure>
  );
}

/** The day in hours (sums), cut hours at both ends left out. */
export function hourly(history: [number, number, number][]): [number, number, number][] {
  const halves = halfHours(history);
  const sums = new Map<number, [number, number, number]>();
  for (const [time, total, blocked] of halves) {
    const key = Math.floor(time / 3_600_000) * 3_600_000;
    const current = sums.get(key) ?? [key, 0, 0];
    current[1] += total; current[2] += blocked;
    sums.set(key, current);
  }
  return [...sums.values()].sort((a, b) => a[0] - b[0]).slice(-24);
}

/** The day in half-hours (sums): servers report every few minutes, which draws a nervous line. */
export function halfHours(history: [number, number, number][]): [number, number, number][] {
  const slot = 1_800_000;
  const sums = new Map<number, [number, number, number]>();
  for (const [time, total, blocked] of history) {
    const key = Math.floor(time / slot) * slot;
    const current = sums.get(key) ?? [key + slot / 2, 0, 0];
    current[1] += total; current[2] += blocked;
    sums.set(key, current);
  }
  const buckets = [...sums.values()].sort((a, b) => a[0] - b[0]);
  // Half-hours cut by the ends of the day hold fewer reports: drawn, they look like sudden drops.
  const first = history[0]?.[0], last = history[history.length - 1]?.[0];
  if (buckets.length > 2 && last !== undefined && last < buckets[buckets.length - 1][0] + slot / 2 - 60_000) buckets.pop();
  if (buckets.length > 2 && first !== undefined && first > buckets[0][0] - slot / 2 + 60_000) buckets.shift();
  return buckets;
}

/** Queries over the day (filled), blocked ones over them; exact values under the pointer. */
function DnsChart({ data, height, narrow = false }: { data: DnsSummary; height: number; narrow?: boolean }) {
  const { t, locale } = useI18n();
  const number = useNumbers();
  const hour = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale]);
  const buckets = useMemo(() => halfHours(data.history), [data.history]);
  const series = useMemo<ChartSeries[]>(() => [
    { id: 'queries', label: t('widgets.dns.queries'), color: QUERIES, area: true, points: buckets.map(([time, total]) => [time, total]) },
    { id: 'blocked', label: t('widgets.dns.blocked'), color: BLOCKED, points: buckets.map(([time, , blocked]) => [time, blocked]) },
  ], [buckets, t]);
  const start = data.history[0]?.[0] ?? data.fetchedAt - 86_400_000;
  return (
    <TimeChart
      series={series}
      start={start}
      end={data.history[data.history.length - 1]?.[0] ?? data.fetchedAt}
      height={height}
      formatValue={value => number.full.format(Math.round(value))}
      formatTime={time => hour.format(time)}
      startLabel={narrow ? undefined : t('widgets.dns.dayAgo')}
      endLabel={t('devices.calme.now')}
      labelledTooltip
      ariaLabel={t('widgets.dns.history')}
    />
  );
}

function DnsTops({ data, count, columns }: { data: DnsSummary; count: number; columns: boolean }) {
  const { t } = useI18n();
  const number = useNumbers();
  const [top, setTop] = useState<TopList>('topBlocked');
  const available = TOPS.filter(id => data[id].length > 0 || id === 'topBlocked');
  if (columns) {
    return (
      <div className="ndw-dns-tops is-columns">
        {available.map(id => (
          <section key={id} className="ndw-dns-top">
            <h4 className="ndw-dns-top-title">{t(`widgets.dns.${id}`)}</h4>
            <TopRows entries={data[id].slice(0, count)} format={value => number.full.format(value)} tone={id === 'topBlocked' ? 'blocked' : 'neutral'} empty={t('widgets.dns.noTop')} />
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="ndw-dns-tops">
      <div className="ndw-tabs" role="tablist" aria-label={t('widgets.dns.top')}>
        {available.map(id => (
          <button key={id} type="button" role="tab" className="ndw-tab" aria-selected={top === id} onClick={() => setTop(id)}>{t(`widgets.dns.${id}`)}</button>
        ))}
      </div>
      <TopRows entries={data[top].slice(0, count)} format={value => number.full.format(value)} tone={top === 'topBlocked' ? 'blocked' : 'neutral'} empty={t('widgets.dns.noTop')} />
    </div>
  );
}

function TopRows({ entries, format, tone, empty }: { entries: DnsTopEntry[]; format: (value: number) => string; tone: 'blocked' | 'neutral'; empty: string }) {
  const max = Math.max(1, ...entries.map(entry => entry.count));
  if (!entries.length) return <p className="ndw-note">{empty}</p>;
  return (
    <ol className={`ndw-dns-rows is-${tone}`}>
      {entries.map(entry => (
        <li key={entry.name} title={[entry.name, format(entry.count)].join(' · ')}>
          <span className="ndw-dns-row-text">
            <span className="ndw-dns-name">{entry.name}</span>
            <span className="ndw-dns-count">{format(entry.count)}</span>
          </span>
          <span className="ndw-dns-meter" aria-hidden="true"><span style={{ width: `${(entry.count / max) * 100}%` }} /></span>
        </li>
      ))}
    </ol>
  );
}

function DnsSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const style = pick(draft.style, STYLES, 'bars');
  const sections = Array.isArray(draft.sections) ? SECTIONS.filter(section => (draft.sections as unknown[]).includes(section)) : [...SECTIONS];
  return (
    <>
      <CalmeField label={t('widgets.connection')}>
        <ConnectionPicker types={['pihole', 'adguard']} section="dns" value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id })} />
      </CalmeField>
      <CalmeField label={t('widgets.display')}>
        <CalmeSegmented label={t('widgets.display')} value={style} options={STYLES.map(value => ({ value, label: t(`widgets.dns.style.${value}`) }))} onChange={value => change({ style: value })} />
      </CalmeField>
      {style !== 'compact' && (
        <CalmeField label={t('widgets.dns.figures')} info={t('widgets.dns.figuresHint')}>
          <div className="ndc-dlg-stack">
            {FIGURES.filter(id => style !== 'ring' || id === 'queries' || id === 'blocked').map(id => {
              const current = figuresOf(draft, style);
              return (
                <CalmeCheckRow key={id} checked={current.includes(id)} onChange={() => change({ figures: current.includes(id) ? current.filter(other => other !== id) : FIGURES.filter(other => other === id || current.includes(other)) })}>
                  <span className="ndc-dlg-name">{t(`widgets.dns.figure.${id}`)}</span>
                </CalmeCheckRow>
              );
            })}
          </div>
        </CalmeField>
      )}
      {style === 'full' && (
        <CalmeField label={t('widgets.dns.sections')}>
          <div className="ndc-dlg-stack">
            {SECTIONS.map(section => (
              <CalmeCheckRow key={section} checked={sections.includes(section)} onChange={() => {
                const next = sections.includes(section) ? sections.filter(item => item !== section) : [...sections, section];
                change({ sections: SECTIONS.filter(item => next.includes(item)) });
              }}>
                <span className="ndc-dlg-name">{t(`widgets.dns.section.${section}`)}</span>
              </CalmeCheckRow>
            ))}
          </div>
        </CalmeField>
      )}
      {style === 'full' && sections.includes('top') && (
        <CalmeField label={t('widgets.dns.topCount')}>
          <CalmeSegmented label={t('widgets.dns.topCount')} value={String(bounded(draft.topCount, 3, 10, 5))} options={['3', '5', '8', '10'].map(value => ({ value, label: value }))} onChange={value => change({ topCount: Number(value) })} />
        </CalmeField>
      )}
    </>
  );
}
