'use client';

import React from 'react';
import { CircleAlert, CircleCheck, RefreshCw } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { SyncthingFolder, SyncthingSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { pick } from '@/components/widgets/content/kit';
import { bytes, byteRate } from '@/components/widgets/content/units';
import { Stat, Track } from '@/components/widgets/media/visual';

const STYLES = ['full', 'compact'] as const;
const FOLDERS = ['all', 'active'] as const;

/** A folder that needs a look: syncing, waiting, not complete or in error. */
export const folderActive = (folder: SyncthingFolder) =>
  folder.state === 'error' || folder.errors > 0 || folder.state === 'syncing' || folder.state === 'scanning' || folder.state === 'waiting' || (folder.completion < 100 && folder.state !== 'paused');

/** The folders a widget shows: hidden ones left out, then only the active ones when asked. */
export function shownFolders(folders: SyncthingFolder[], settings: WidgetSettings): SyncthingFolder[] {
  const hidden = new Set(Array.isArray(settings.hiddenFolders) ? settings.hiddenFolders.filter((id): id is string => typeof id === 'string') : []);
  const visible = folders.filter(folder => !hidden.has(folder.id));
  return pick(settings.folders, FOLDERS, 'all') === 'active' ? visible.filter(folderActive) : visible;
}

/**
 * Syncthing: are the folders up to date, which ones are syncing and how far,
 * which devices are connected and how fast data moves. Read only.
 */
export default function CalmeSyncthing(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<SyncthingSummary> widget="syncthing" refreshMs={30_000} skeleton={[22, 30, 30]} {...props}
      extraSettings={(draft, change, data) => {
        const hidden = new Set(Array.isArray(draft.hiddenFolders) ? draft.hiddenFolders.filter((id): id is string => typeof id === 'string') : []);
        const toggle = (id: string, on: boolean) => {
          const next = new Set(hidden);
          if (on) next.delete(id); else next.add(id);
          change({ hiddenFolders: next.size ? [...next] : null });
        };
        return (
          <>
            <CalmeRow label={t('widgets.display')}>
              <CalmeSegmented label={t('widgets.display')} value={pick(draft.style, STYLES, 'full')} options={STYLES.map(value => ({ value, label: t(`widgets.syncthing.style.${value}`) }))} onChange={value => change({ style: value === 'full' ? null : value })} />
            </CalmeRow>
            <CalmeRow label={t('widgets.syncthing.folders')} info={t('widgets.syncthing.foldersHint')}>
              <CalmeSegmented label={t('widgets.syncthing.folders')} value={pick(draft.folders, FOLDERS, 'all')} options={FOLDERS.map(value => ({ value, label: t(`widgets.syncthing.folders.${value}`) }))} onChange={value => change({ folders: value === 'all' ? null : value })} />
            </CalmeRow>
            {pick(draft.style, STYLES, 'full') === 'full' && (
              <>
                <CalmeRow label={t('widgets.syncthing.showRate')}>
                  <CalmeSwitch label={t('widgets.syncthing.showRate')} checked={draft.rate !== false} onChange={on => change({ rate: on ? null : false })} />
                </CalmeRow>
                <CalmeRow label={t('widgets.syncthing.showDevices')}>
                  <CalmeSwitch label={t('widgets.syncthing.showDevices')} checked={draft.devices !== false} onChange={on => change({ devices: on ? null : false })} />
                </CalmeRow>
              </>
            )}
            {(data?.folders.length ?? 0) > 1 && (
              <CalmeField label={t('widgets.syncthing.shownFolders')}>
                <div className="ndw-settings-checks">
                  {data!.folders.map(folder => (
                    <CalmeRow key={folder.id} label={folder.label}>
                      <CalmeSwitch label={folder.label} checked={!hidden.has(folder.id)} onChange={on => toggle(folder.id, on)} />
                    </CalmeRow>
                  ))}
                </div>
              </CalmeField>
            )}
          </>
        );
      }}>
      {data => <Syncthing data={data} settings={props.settings} />}
    </KitWidget>
  );
}

function Syncthing({ data, settings }: { data: SyncthingSummary; settings: WidgetSettings }) {
  const { t, locale } = useI18n();
  const compact = pick(settings.style, STYLES, 'full') === 'compact';
  const folders = shownFolders(data.folders, settings);
  // The state line counts every folder shown or not: a hidden folder in error still says so.
  const all = shownFolders(data.folders, { ...settings, folders: null });
  const failing = all.filter(folder => folder.state === 'error' || folder.errors > 0).length;
  const moving = all.filter(folderActive).length - failing;
  const state = failing ? 'error' : moving > 0 ? 'syncing' : 'idle';
  const Icon = state === 'error' ? CircleAlert : state === 'syncing' ? RefreshCw : CircleCheck;
  const connected = data.devices.filter(device => device.connected).length;
  const showRate = !compact && settings.rate !== false && data.inRate !== undefined;
  const showDevices = !compact && settings.devices !== false && data.devices.length > 0;
  return (
    <div className={`ndw-kit ${compact ? 'is-compact' : ''}`}>
      <span className={`ndw-kit-state ${state === 'error' ? 'is-bad' : state === 'syncing' ? 'is-pending' : ''}`}>
        <Icon size={13} aria-hidden="true" />
        <span className="ndw-kit-name">{data.name}</span>
        <span className="ndw-kit-word">{state === 'error' ? t('widgets.syncthing.state.errors', { count: failing }) : state === 'syncing' ? t('widgets.syncthing.state.syncing', { count: moving }) : t('widgets.syncthing.state.idle')}</span>
        {compact && data.devices.length > 0 && <span className="ndw-kit-word">· {t('widgets.syncthing.devicesShort', { connected, total: data.devices.length })}</span>}
      </span>
      {data.folders.length === 0
        ? <span className="ndw-media-sub">{t('widgets.syncthing.noFolders')}</span>
        : folders.length === 0
          ? <span className="ndw-media-sub is-quiet">{t('widgets.syncthing.nothingActive')}</span>
          : <ul className="ndw-kit-list">{folders.map(folder => <Folder key={folder.id} folder={folder} compact={compact} />)}</ul>}
      {(showRate || (!compact && settings.devices !== false && data.devices.length > 0)) && (
        <div className="ndw-mx-statrow">
          {!compact && data.devices.length > 0 && <Stat value={`${connected}/${data.devices.length}`} label={t('widgets.syncthing.devices')} />}
          {showRate && <Stat value={byteRate(data.inRate!, locale)} label={t('widgets.syncthing.down')} tone={data.inRate! < 1000 ? 'muted' : undefined} />}
          {showRate && data.outRate !== undefined && <Stat value={byteRate(data.outRate, locale)} label={t('widgets.syncthing.up')} tone={data.outRate < 1000 ? 'muted' : undefined} />}
        </div>
      )}
      {showDevices && (
        <span className="ndw-kit-chips" aria-label={t('widgets.syncthing.devices')}>
          {data.devices.map(device => (
            <span key={device.id} className={device.connected ? 'is-on' : ''} title={t(device.paused ? 'widgets.syncthing.device.paused' : device.connected ? 'widgets.syncthing.device.connected' : 'widgets.syncthing.device.offline')}>{device.name}</span>
          ))}
        </span>
      )}
    </div>
  );
}

function Folder({ folder, compact }: { folder: SyncthingFolder; compact: boolean }) {
  const { t, locale } = useI18n();
  const done = folder.completion >= 100 && folder.state !== 'syncing';
  const bad = folder.state === 'error' || folder.errors > 0;
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: folder.completion < 99 ? 0 : 1 }).format(folder.completion / 100);
  return (
    <li className="ndw-kit-row">
      <span className="ndw-kit-row-head">
        <span className="ndw-kit-row-name" title={folder.id}>{folder.label}</span>
        <span className={`ndw-kit-row-value ${bad ? 'is-bad' : folder.state === 'paused' ? 'is-quiet' : ''}`}>
          {bad ? t('widgets.syncthing.folderErrors', { count: folder.errors || 1 })
            : done ? t(`widgets.syncthing.folder.${folder.state === 'paused' ? 'paused' : 'idle'}`)
              : percent}
        </span>
      </span>
      {!done && !bad && folder.state !== 'paused' && (
        <>
          <Track value={folder.completion} thin />
          {!compact && <span className="ndw-media-sub">{[t(`widgets.syncthing.folder.${folder.state}`), folder.needBytes ? t('widgets.syncthing.left', { size: bytes(folder.needBytes, locale) }) : ''].filter(Boolean).join(' · ')}</span>}
        </>
      )}
    </li>
  );
}
