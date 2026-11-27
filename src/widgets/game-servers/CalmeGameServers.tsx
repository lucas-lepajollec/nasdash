'use client';

import React, { useState } from 'react';
import { Play, RotateCw, Square } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { GameServer, GameServersSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { formatBytes } from '@/components/widgets/deviceReadings';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { KitWidget, type KitTools } from '@/components/widgets/content/KitWidget';
import { Stat } from '@/components/widgets/media/visual';

type ServerAction = 'start' | 'stop' | 'restart';
/** Every few seconds while a server starts or updates, then every half minute. */
const refreshPace = (data: GameServersSummary | undefined) => data?.servers.some(server => server.state === 'starting' || server.state === 'updating') ? 5_000 : 30_000;

/**
 * Game servers (Crafty Controller, or a Minecraft server pinged directly):
 * each server with its state, version, message of the day, players and, from
 * Crafty, its load. An administrator starts, stops or restarts a Crafty
 * server; stopping and restarting ask first unless the settings turn it off.
 */
export default function CalmeGameServers(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<GameServersSummary> widget="game-servers" refreshMs={refreshPace} skeleton={[22, 48, 48]} {...props}
      extraSettings={(draft, change) => (
        <>
          <CalmeRow label={t('widgets.games.showPlayers')}>
            <CalmeSwitch label={t('widgets.games.showPlayers')} checked={draft.players !== false} onChange={on => change({ players: on ? null : false })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.games.showMotd')}>
            <CalmeSwitch label={t('widgets.games.showMotd')} checked={draft.motd !== false} onChange={on => change({ motd: on ? null : false })} />
          </CalmeRow>
          <CalmeRow label={t('widgets.updates.confirmSetting')} info={t('widgets.games.confirmHint')}>
            <CalmeSwitch label={t('widgets.updates.confirmSetting')} checked={draft.confirm !== false} onChange={on => change({ confirm: on ? null : false })} />
          </CalmeRow>
        </>
      )}>
      {(data, tools) => <Servers data={data} tools={tools} settings={props.settings} />}
    </KitWidget>
  );
}

function Servers({ data, tools, settings }: { data: GameServersSummary; tools: KitTools; settings: WidgetSettings }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState<{ server: GameServer; action: ServerAction } | null>(null);
  const online = data.servers.filter(server => server.state === 'online').length;
  const players = data.servers.reduce((sum, server) => sum + (server.players ?? 0), 0);
  const act = (server: GameServer, action: ServerAction) => {
    if (action !== 'start' && settings.confirm !== false) { setAsking({ server, action }); return; }
    void tools.run(action, server.id);
  };
  if (data.servers.length === 0) return <span className="ndw-media-sub is-quiet">{t('widgets.games.none')}</span>;
  return (
    <div className="ndw-kit ndw-game">
      {data.servers.length > 1 && (
        <div className="ndw-mx-statrow">
          <Stat value={<>{online}<span className="ndw-mx-stat-of">/{data.servers.length}</span></>} label={t('widgets.games.onlineLabel')} tone={online ? undefined : 'muted'} />
          <Stat value={players} label={t('widgets.games.playersLabel')} tone={players ? undefined : 'muted'} />
        </div>
      )}
      <ul className="ndw-kit-list ndw-game-list">
        {data.servers.map(server => (
          <Server key={server.id} server={server} settings={settings} control={data.canControl === true && server.controllable === true}
            busy={tools.busy?.endsWith(`:${server.id}`) === true} onAction={action => act(server, action)} />
        ))}
      </ul>
      <ConfirmModal
        isOpen={asking !== null}
        onClose={() => setAsking(null)}
        onConfirm={() => { const target = asking; setAsking(null); if (target) void tools.run(target.action, target.server.id); }}
        title={asking ? t(`widgets.games.confirm.${asking.action}`, { name: asking.server.name }) : ''}
        description={asking?.server.players ? t('widgets.games.confirmPlayers', { count: asking.server.players }) : t('widgets.games.confirmNoPlayers')}
        confirmLabel={asking ? t(`widgets.games.action.${asking.action}`) : ''}
        cancelLabel={t('Annuler')}
      />
    </div>
  );
}

/**
 * One server as a kit row: its name and version, its players (or state) on the
 * right, then its message of the day, its load and who is playing. The
 * controls appear beside the state when the row is hovered or focused.
 */
function Server({ server, settings, control, busy, onAction }: { server: GameServer; settings: WidgetSettings; control: boolean; busy: boolean; onAction: (action: ServerAction) => void }) {
  const { t, language } = useI18n();
  const online = server.state === 'online';
  const load = [
    server.cpuPercent !== undefined ? t('widgets.games.cpu', { value: Math.round(server.cpuPercent) }) : '',
    server.memoryBytes ? t('widgets.games.memory', { value: formatBytes(server.memoryBytes, language) }) : server.memoryPercent !== undefined ? t('widgets.games.memory', { value: `${Math.round(server.memoryPercent)} %` }) : '',
    server.latencyMs !== undefined ? t('widgets.games.latency', { value: server.latencyMs }) : '',
  ].filter(Boolean).join(' · ');
  const names = online && settings.players !== false && server.playerNames?.length ? server.playerNames.join(', ') : '';
  const value = online
    ? (server.players !== undefined ? (server.maxPlayers ? t('widgets.games.playersOf', { count: server.players, max: server.maxPlayers }) : t('widgets.games.players', { count: server.players })) : t('widgets.games.state.online'))
    : t(`widgets.games.state.${server.state}`);
  const button = (action: ServerAction, icon: React.ReactNode) => (
    <button type="button" className="ndc-icon-button" disabled={busy} onClick={() => onAction(action)}
      aria-label={t(`widgets.games.actionOf.${action}`, { name: server.name })} title={t(`widgets.games.actionOf.${action}`, { name: server.name })}>{icon}</button>
  );
  return (
    <li className="ndw-kit-row ndw-game-row">
      <span className="ndw-kit-row-head">
        <span className="ndw-game-title">
          <span className="ndw-kit-row-name" title={server.name}>{server.name}</span>
          {server.version && <span className="ndw-game-version">{server.version}</span>}
        </span>
        <span className="ndw-game-side">
          {control && !busy && (
            <span className="ndw-game-actions">
              {(server.state === 'offline' || server.state === 'crashed') && button('start', <Play size={12} />)}
              {online && <>{button('restart', <RotateCw size={12} />)}{button('stop', <Square size={11} />)}</>}
            </span>
          )}
          {busy && <span className="nd-spinner" style={{ width: 11, height: 11 }} aria-hidden="true" />}
          <span className={`ndw-kit-row-value ${server.state === 'crashed' ? 'is-bad' : online || server.state === 'starting' || server.state === 'updating' ? '' : 'is-quiet'}`}>{value}</span>
        </span>
      </span>
      {online && settings.motd !== false && server.motd && <span className="ndw-media-sub">{server.motd}</span>}
      {online && (load || names) && <span className="ndw-media-sub">{[names, load].filter(Boolean).join(' · ')}</span>}
    </li>
  );
}
