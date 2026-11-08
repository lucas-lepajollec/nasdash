'use client';

import React from 'react';
import { CircleAlert, CircleCheck, RefreshCw } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { SyncthingFolder, SyncthingSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { bytes, byteRate } from '@/components/widgets/content/units';
import { Stat, Track } from '@/components/widgets/media/visual';

/**
 * Syncthing: are the folders up to date, which ones are syncing and how far,
 * which devices are connected and how fast data moves. Read only.
 */
export default function CalmeSyncthing(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<SyncthingSummary> widget="syncthing" refreshMs={30_000} skeleton={[22, 30, 30]} {...props}
      extraSettings={(draft, change) => (
        <CalmeRow label={t('widgets.syncthing.showDevices')}>
          <CalmeSwitch label={t('widgets.syncthing.showDevices')} checked={draft.devices !== false} onChange={on => change({ devices: on ? null : false })} />
        </CalmeRow>
      )}>
      {data => <Syncthing data={data} devices={props.settings.devices !== false} />}
    </KitWidget>
  );
}

function Syncthing({ data, devices }: { data: SyncthingSummary; devices: boolean }) {
  const { t, locale } = useI18n();
  const failing = data.folders.filter(folder => folder.state === 'error' || folder.errors > 0).length;
  const moving = data.folders.filter(folder => folder.state === 'syncing' || folder.state === 'scanning' || folder.completion < 100 && folder.state !== 'paused').length;
  const state = failing ? 'error' : moving ? 'syncing' : 'idle';
  const Icon = state === 'error' ? CircleAlert : state === 'syncing' ? RefreshCw : CircleCheck;
  const connected = data.devices.filter(device => device.connected).length;
  return (
    <div className="ndw-kit">
      <span className={`ndw-kit-state ${state === 'error' ? 'is-bad' : state === 'syncing' ? 'is-pending' : ''}`}>
        <Icon size={13} aria-hidden="true" />
        <span className="ndw-kit-name">{data.name}</span>
        <span className="ndw-kit-word">{state === 'error' ? t('widgets.syncthing.state.errors', { count: failing }) : state === 'syncing' ? t('widgets.syncthing.state.syncing', { count: moving }) : t('widgets.syncthing.state.idle')}</span>
      </span>
      {data.folders.length === 0
        ? <span className="ndw-media-sub">{t('widgets.syncthing.noFolders')}</span>
        : <ul className="ndw-kit-list">{data.folders.map(folder => <Folder key={folder.id} folder={folder} />)}</ul>}
      {(data.inRate !== undefined || data.devices.length > 0) && (
        <div className="ndw-mx-statrow">
          {data.devices.length > 0 && <Stat value={`${connected}/${data.devices.length}`} label={t('widgets.syncthing.devices')} />}
          {data.inRate !== undefined && <Stat value={byteRate(data.inRate, locale)} label={t('widgets.syncthing.down')} tone={data.inRate < 1000 ? 'muted' : undefined} />}
          {data.outRate !== undefined && <Stat value={byteRate(data.outRate, locale)} label={t('widgets.syncthing.up')} tone={data.outRate < 1000 ? 'muted' : undefined} />}
        </div>
      )}
      {devices && data.devices.length > 0 && (
        <span className="ndw-kit-chips" aria-label={t('widgets.syncthing.devices')}>
          {data.devices.map(device => (
            <span key={device.id} className={device.connected ? 'is-on' : ''} title={t(device.paused ? 'widgets.syncthing.device.paused' : device.connected ? 'widgets.syncthing.device.connected' : 'widgets.syncthing.device.offline')}>{device.name}</span>
          ))}
        </span>
      )}
    </div>
  );
}

function Folder({ folder }: { folder: SyncthingFolder }) {
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
          <span className="ndw-media-sub">{[t(`widgets.syncthing.folder.${folder.state}`), folder.needBytes ? t('widgets.syncthing.left', { size: bytes(folder.needBytes, locale) }) : ''].filter(Boolean).join(' · ')}</span>
        </>
      )}
    </li>
  );
}
