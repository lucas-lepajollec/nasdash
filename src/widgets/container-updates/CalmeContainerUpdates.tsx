'use client';

import React, { useState } from 'react';
import { ArrowRight, ArrowUpCircle, Box, Check, CircleAlert, CircleCheck, ExternalLink } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { ContainerUpdate, ContainerUpdatesSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { KitWidget, type KitTools } from '@/components/widgets/content/KitWidget';
import { bounded } from '@/components/widgets/content/kit';

const ROWS = [3, 5, 8, 12, 20] as const;
const ICONS = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons';

/** The app's icon name from its image: `immich-app/immich-server` → `immich`, `library/postgres` → `postgres`. */
/** Images whose name differs from the collection's: `pihole` is `pi-hole` there. */
const ICON_ALIASES: Record<string, string> = { pihole: 'pi-hole', adguardhome: 'adguard-home', 'home-assistant': 'home-assistant', homeassistant: 'home-assistant', qbittorrent: 'qbittorrent', 'uptime-kuma': 'uptime-kuma', nginx: 'nginx', 'nginx-proxy-manager': 'nginx-proxy-manager' };
export function iconName(image: string): string | undefined {
  const name = image.split('/').pop()?.split(':')[0]?.toLowerCase().replace(/-(server|app|web|ce|ee)$/, '') ?? '';
  return /^[a-z0-9][a-z0-9-]{0,40}$/.test(name) ? ICON_ALIASES[name] ?? name : undefined;
}

/** Every few seconds while an update runs, then every five minutes (stable: the shell follows it answer by answer). */
const refreshPace = (data: ContainerUpdatesSummary | undefined) => data?.updates.some(update => update.status === 'updating') ? 4_000 : 5 * 60_000;

/** The containers a widget lists: rebuilt images (same tag, new digest) only when asked. */
export function shownUpdates(updates: ContainerUpdate[], settings: WidgetSettings): ContainerUpdate[] {
  return settings.digests === false ? updates.filter(update => update.kind !== 'digest' || update.status) : updates;
}

/**
 * Container updates (What's Up Docker): which containers have a newer image,
 * from the current version to the new one, the biggest jumps first, with the
 * release notes when the registry gives them. An administrator can update one
 * container or all of them, as WUD's own button does: after a confirmation,
 * which the widget's settings can turn off.
 */
export default function CalmeContainerUpdates(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const rows = bounded(props.settings.rows, 3, 20, 5);
  return (
    <KitWidget<ContainerUpdatesSummary> widget="container-updates" skeleton={[40, 44, 44]} {...props}
      refreshMs={refreshPace}
      extraSettings={(draft, change) => (
        <>
          <CalmeRow label={t('widgets.updates.rows')}>
            <CalmeSegmented label={t('widgets.updates.rows')} value={String(bounded(draft.rows, 3, 20, 5))} options={ROWS.map(count => ({ value: String(count), label: String(count) }))} onChange={value => change({ rows: Number(value) === 5 ? null : Number(value) })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.updates.showDigests')} info={t('widgets.updates.showDigestsHint')}>
            <CalmeSwitch label={t('widgets.updates.showDigests')} checked={draft.digests !== false} onChange={on => change({ digests: on ? null : false })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.updates.showIcons')}>
            <CalmeSwitch label={t('widgets.updates.showIcons')} checked={draft.icons !== false} onChange={on => change({ icons: on ? null : false })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.updates.confirmSetting')} info={t('widgets.updates.confirmSettingHint')}>
            <CalmeSwitch label={t('widgets.updates.confirmSetting')} checked={draft.confirm !== false} onChange={on => change({ confirm: on ? null : false })} />
          </CalmeRow>
        </>
      )}>
      {(data, tools) => <Updates data={data} tools={tools} rows={rows} settings={props.settings} />}
    </KitWidget>
  );
}

function Updates({ data, tools, rows, settings }: { data: ContainerUpdatesSummary; tools: KitTools; rows: number; settings: WidgetSettings }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState<ContainerUpdate | 'all' | null>(null);
  const updates = shownUpdates(data.updates, settings);
  const pending = updates.filter(update => update.status !== 'updated');
  const count = pending.length;
  const hidden = Math.max(0, updates.length - rows);
  const control = data.canControl === true;
  const ready = updates.filter(update => update.updatable && update.id && !update.status);
  const start = (target: ContainerUpdate | 'all') => {
    if (settings.confirm !== false) { setAsking(target); return; }
    void (target === 'all' ? tools.run('updateAll') : tools.run('update', target.id));
  };
  const confirmed = () => {
    const target = asking;
    setAsking(null);
    if (target) void (target === 'all' ? tools.run('updateAll') : tools.run('update', target.id));
  };
  const majors = ready.filter(update => update.level === 'major').length;

  return (
    <div className="ndw-kit ndw-upd">
      <div className="ndw-upd-head">
        <span className="ndw-upd-count">
          {count ? <span className="ndw-upd-number">{count}</span> : <CircleCheck size={18} aria-hidden="true" className="ndw-upd-ok" />}
          <span className="ndw-upd-label">
            <span>{count ? t('widgets.updates.availableLabel') : t('widgets.updates.none')}</span>
            <span className="ndw-media-sub">{[t('widgets.updates.watched', { count: data.total }), data.errors ? t('widgets.updates.errors', { count: data.errors }) : ''].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
        {control && ready.length > 1 && (
          <button type="button" className="nd-btn nd-btn-compact" disabled={tools.busy !== null} onClick={() => start('all')}>{t('widgets.updates.updateAll')}</button>
        )}
      </div>
      {updates.length > 0 && (
        <ul className="ndw-upd-list">
          {updates.slice(0, rows).map(update => <Row key={`${update.id ?? update.name}:${update.image}`} update={update} icons={settings.icons !== false} control={control} busy={tools.busy === `update:${update.id}`} onUpdate={() => start(update)} />)}
        </ul>
      )}
      {hidden > 0 && <span className="ndw-media-sub">{t('widgets.updates.more', { count: hidden })}</span>}
      <ConfirmModal
        isOpen={asking !== null}
        onClose={() => setAsking(null)}
        onConfirm={confirmed}
        title={asking === 'all' ? t('widgets.updates.confirmAllTitle', { count: ready.length }) : t('widgets.updates.confirmTitle', { name: asking?.name ?? '' })}
        description={[
          asking === 'all' ? t('widgets.updates.confirmAll', { count: ready.length }) : asking ? t('widgets.updates.confirm', { name: asking.name, from: asking.current, to: asking.latest ?? asking.current }) : '',
          (asking === 'all' ? majors > 0 : asking?.level === 'major') ? t('widgets.updates.majorWarning') : '',
        ].filter(Boolean).join(' ')}
        confirmLabel={t('widgets.updates.update')}
        cancelLabel={t('Annuler')}
      />
    </div>
  );
}

function AppIcon({ image }: { image: string }) {
  const [failed, setFailed] = useState(false);
  const name = iconName(image);
  return (
    <span className="ndw-upd-icon" aria-hidden="true">
      {name && !failed
        // eslint-disable-next-line @next/next/no-img-element -- a small remote SVG with a fallback
        ? <img src={`${ICONS}/svg/${name}.svg`} alt="" width={18} height={18} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : <Box size={14} />}
    </span>
  );
}

function Row({ update, icons, control, busy, onUpdate }: { update: ContainerUpdate; icons: boolean; control: boolean; busy: boolean; onUpdate: () => void }) {
  const { t } = useI18n();
  const updating = busy || update.status === 'updating';
  return (
    <li className={`ndw-upd-row ${update.status === 'updated' ? 'is-done' : ''}`}>
      {icons && <AppIcon image={update.image} />}
      <span className="ndw-upd-main">
        <span className="ndw-upd-name">
          <span title={update.image}>{update.name}</span>
          {update.level && <span className={`ndw-upd-level is-${update.level}`}>{t(`widgets.updates.level.${update.level}`)}</span>}
          {update.kind === 'digest' && <span className="ndw-upd-level">{t('widgets.updates.rebuilt')}</span>}
          {update.link && (
            <a className="ndw-upd-notes" href={update.link} target="_blank" rel="noreferrer noopener" aria-label={t('widgets.updates.notes', { name: update.name })} title={t('widgets.updates.notes', { name: update.name })}>
              <ExternalLink size={11} />
            </a>
          )}
        </span>
        <span className="ndw-upd-versions">
          <span>{update.current}</span>
          {update.latest && update.latest !== update.current && <><ArrowRight size={10} aria-hidden="true" /><span className="is-new">{update.latest}</span></>}
        </span>
      </span>
      <span className="ndw-upd-side">
        {update.status === 'updated' ? <span className="ndw-upd-state is-done"><Check size={12} aria-hidden="true" />{t('widgets.updates.updated')}</span>
          : updating ? <span className="ndw-upd-state"><span className="nd-spinner" style={{ width: 11, height: 11 }} aria-hidden="true" />{t('widgets.updates.updating')}</span>
            : update.status === 'failed' ? (
              <span className="ndw-upd-state is-bad" title={update.error ? t(update.error) : undefined}>
                <CircleAlert size={12} aria-hidden="true" />{t('widgets.updates.failed')}
                {control && update.updatable && <button type="button" className="ndc-icon-button" onClick={onUpdate} aria-label={t('widgets.updates.retry', { name: update.name })} title={t('widgets.updates.retry', { name: update.name })}><ArrowUpCircle size={13} /></button>}
              </span>
            )
              : control && update.updatable && update.id
                ? <button type="button" className="ndc-icon-button ndw-upd-go" onClick={onUpdate} aria-label={t('widgets.updates.updateOne', { name: update.name })} title={t('widgets.updates.updateOne', { name: update.name })}><ArrowUpCircle size={14} /></button>
                : null}
      </span>
    </li>
  );
}
