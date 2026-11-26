'use client';

import React, { useState } from 'react';
import { Play, RotateCw, Square, Users } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { GameServer, GameServersSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { formatBytes } from '@/components/widgets/deviceReadings';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { KitWidget, type KitTools } from '@/components/widgets/content/KitWidget';

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
        <span className="ndw-media-sub">{[t('widgets.games.online', { count: online, total: data.servers.length }), online ? t('widgets.games.players', { count: players }) : ''].filter(Boolean).join(' · ')}</span>
      )}
      <ul className="ndw-game-list">
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

function Server({ server, settings, control, busy, onAction }: { server: GameServer; settings: WidgetSettings; control: boolean; busy: boolean; onAction: (action: ServerAction) => void }) {
  const { t, language } = useI18n();
  const online = server.state === 'online';
  const load = [
    server.cpuPercent !== undefined ? `CPU ${Math.round(server.cpuPercent)} %` : '',
    server.memoryBytes ? `RAM ${formatBytes(server.memoryBytes, language)}` : server.memoryPercent !== undefined ? `RAM ${Math.round(server.memoryPercent)} %` : '',
    server.latencyMs !== undefined ? `${server.latencyMs} ms` : '',
  ].filter(Boolean).join(' · ');
  const button = (action: ServerAction, icon: React.ReactNode) => (
    <button type="button" className="ndc-icon-button" disabled={busy} onClick={() => onAction(action)}
      aria-label={t(`widgets.games.actionOf.${action}`, { name: server.name })} title={t(`widgets.games.actionOf.${action}`, { name: server.name })}>{icon}</button>
  );
  return (
    <li className={`ndw-game-row is-${server.state}`}>
      <span className="ndw-game-dot" aria-hidden="true" />
      <span className="ndw-game-main">
        <span className="ndw-game-name">
          <span title={server.name}>{server.name}</span>
          {server.version && <span className="ndw-game-version">{server.version}</span>}
        </span>
        <span className="ndw-game-sub">
          {online ? (settings.motd !== false && server.motd ? server.motd : load) : t(`widgets.games.state.${server.state}`)}
        </span>
        {online && settings.motd !== false && server.motd && load && <span className="ndw-game-sub">{load}</span>}
        {online && settings.players !== false && server.playerNames && server.playerNames.length > 0 && (
          <span className="ndw-game-names" title={server.playerNames.join(', ')}>{server.playerNames.join(', ')}</span>
        )}
      </span>
      <span className="ndw-game-side">
        {online && server.players !== undefined && (
          <span className="ndw-game-players" title={t('widgets.games.players', { count: server.players })}>
            <Users size={12} aria-hidden="true" />{server.maxPlayers ? t('widgets.games.playersOf', { count: server.players, max: server.maxPlayers }) : server.players}
          </span>
        )}
        {busy && <span className="nd-spinner" style={{ width: 11, height: 11 }} aria-hidden="true" />}
        {control && !busy && (server.state === 'offline' || server.state === 'crashed') && button('start', <Play size={13} />)}
        {control && !busy && online && <>{button('restart', <RotateCw size={13} />)}{button('stop', <Square size={12} />)}</>}
      </span>
      <span className="sr-only">{t(`widgets.games.state.${server.state}`)}</span>
    </li>
  );
}
