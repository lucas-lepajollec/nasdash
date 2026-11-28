'use client';

import React, { useState } from 'react';
import { Play, RotateCw, Square } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { GameServer, GameServersSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { useConfig } from '@/hooks/useConfig';
import { formatBytes } from '@/components/widgets/deviceReadings';
import { UsageBar } from '@/components/charts/Gauges';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { KitWidget, type KitTools } from '@/components/widgets/content/KitWidget';
import { uptimeText } from '@/widgets/devices/format';

type ServerAction = 'start' | 'stop' | 'restart';
/** Every few seconds while a server starts or updates, then every half minute. */
const refreshPace = (data: GameServersSummary | undefined) => data?.servers.some(server => server.state === 'starting' || server.state === 'updating') ? 5_000 : 30_000;

/**
 * Game servers (Crafty Controller, or a Minecraft server pinged directly),
 * laid out like the devices fleet: each server with its own icon, its version
 * and how long it has run, its message of the day, then its players, processor
 * and memory as bars, and who is playing. An administrator starts, stops or restarts a Crafty
 * server; stopping and restarting ask first unless the settings turn it off.
 */
export default function CalmeGameServers(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  return (
    <KitWidget<GameServersSummary> widget="game-servers" refreshMs={refreshPace} skeleton={[64, 64]} {...props}
      aside={data => data.servers.length > 1 && <span className="ndc-title-note">{t('widgets.games.onlineCount', { online: data.servers.filter(server => server.state === 'online').length, total: data.servers.length })}</span>}
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
      {(data, tools) => <Servers data={data} tools={tools} widgetId={props.widgetId} settings={props.settings} />}
    </KitWidget>
  );
}

function Servers({ data, tools, widgetId, settings }: { data: GameServersSummary; tools: KitTools; widgetId: string; settings: WidgetSettings }) {
  const { t } = useI18n();
  const { user } = useConfig();
  const [asking, setAsking] = useState<{ server: GameServer; action: ServerAction } | null>(null);
  const act = (server: GameServer, action: ServerAction) => {
    if (action !== 'start' && settings.confirm !== false) { setAsking({ server, action }); return; }
    void tools.run(action, server.id);
  };
  const iconUrl = (icon: string) => {
    const query = new URLSearchParams({ widget: 'game-servers', widgetId, id: icon });
    if (user?.role === 'admin') query.set('draft', JSON.stringify(settings));
    return `/api/widgets/kit/image?${query}`;
  };
  if (data.servers.length === 0) return <span className="ndw-media-sub is-quiet">{t('widgets.games.none')}</span>;
  return (
    <div className="ndw-kit ndw-game">
      <ul className="ndw-game-list">
        {data.servers.map(server => (
          <Server key={server.id} server={server} settings={settings} iconUrl={iconUrl} control={data.canControl === true && server.controllable === true}
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

/** The server's own icon, pixels kept sharp; its initial on a plain tile when it has none. */
function ServerIcon({ server, url }: { server: GameServer; url: (icon: string) => string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="ndw-game-icon" aria-hidden="true">
      {server.icon && !failed
        // eslint-disable-next-line @next/next/no-img-element -- the server's icon relayed by NasDash, with a fallback
        ? <img src={url(server.icon)} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        : server.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** One measure as in the devices fleet: its name and value, a bar in the theme's accent under them. */
function Meter({ label, value, percent }: { label: string; value: string; percent?: number }) {
  return (
    <span className="ndc-m">
      <span className="ndc-m-head">
        <span className="ndc-m-label"><span className="ndc-m-name">{label}</span></span>
        <span className="ndc-m-value">{value}</span>
      </span>
      {percent !== undefined && <UsageBar percent={percent} color="var(--nd-accent)" />}
    </span>
  );
}

/**
 * One server: its icon, name, version, how long it has run and its world; its
 * message of the day; its players, processor and memory as bars; who is
 * playing. A server that is not running is dimmed, with its state in words.
 * The controls appear beside the name when the server is hovered or focused.
 */
function Server({ server, settings, iconUrl, control, busy, onAction }: { server: GameServer; settings: WidgetSettings; iconUrl: (icon: string) => string; control: boolean; busy: boolean; onAction: (action: ServerAction) => void }) {
  const { t, language } = useI18n();
  const online = server.state === 'online';
  const up = online && server.startedAt ? uptimeText((Date.now() - server.startedAt) / 1000, t) : '';
  const sub = [
    online ? '' : t(`widgets.games.state.${server.state}`),
    server.version ?? '',
    up ? t('widgets.games.upFor', { time: up }) : '',
    online && server.latencyMs !== undefined ? t('widgets.games.latency', { value: server.latencyMs }) : '',
    server.worldBytes ? t('widgets.games.world', { size: formatBytes(server.worldBytes, language) }) : '',
  ].filter(Boolean);
  const memory = server.memoryBytes ? formatBytes(server.memoryBytes, language) : server.memoryPercent !== undefined ? `${Math.round(server.memoryPercent)} %` : '';
  const meters = [server.players !== undefined, server.cpuPercent !== undefined, !!memory].filter(Boolean).length;
  const names = settings.players !== false && server.playerNames?.length ? server.playerNames.join(', ') : '';
  const button = (action: ServerAction, icon: React.ReactNode) => (
    <button type="button" className="ndc-icon-button" disabled={busy} onClick={() => onAction(action)}
      aria-label={t(`widgets.games.actionOf.${action}`, { name: server.name })} title={t(`widgets.games.actionOf.${action}`, { name: server.name })}>{icon}</button>
  );
  return (
    <li className={`ndw-game-server ${online ? '' : 'is-off'}`}>
      <ServerIcon server={server} url={iconUrl} />
      <span className="ndw-game-head">
        <span className="ndw-game-text">
          <span className="ndw-game-name" title={server.name}>{server.name}</span>
          {sub.length > 0 && (
            <span className="ndw-game-sub">
              {sub.map((part, index) => (
                <React.Fragment key={index}>
                  {index > 0 && ' · '}
                  {index === 0 && server.state === 'crashed' ? <span className="ndw-game-crashed">{part}</span> : part}
                </React.Fragment>
              ))}
            </span>
          )}
        </span>
        {busy
          ? <span className="nd-spinner" style={{ width: 11, height: 11 }} aria-hidden="true" />
          : control && (
            <span className="ndw-game-actions">
              {(server.state === 'offline' || server.state === 'crashed') && button('start', <Play size={12} />)}
              {online && <>{button('restart', <RotateCw size={12} />)}{button('stop', <Square size={11} />)}</>}
            </span>
          )}
      </span>
      {online && settings.motd !== false && server.motd && <span className="ndw-game-motd">{server.motd}</span>}
      {online && meters > 0 && (
        <span className="ndw-game-meters" style={{ '--ndw-meters': meters } as React.CSSProperties}>
          {server.players !== undefined && (
            <Meter label={t('widgets.games.meter.players')} value={server.maxPlayers ? `${server.players}/${server.maxPlayers}` : String(server.players)}
              percent={server.maxPlayers ? (server.players / server.maxPlayers) * 100 : undefined} />
          )}
          {server.cpuPercent !== undefined && <Meter label={t('widgets.games.meter.cpu')} value={`${Math.round(server.cpuPercent)} %`} percent={server.cpuPercent} />}
          {memory && <Meter label={t('widgets.games.meter.memory')} value={memory} percent={server.memoryPercent} />}
        </span>
      )}
      {online && names && <span className="ndw-game-players">{names}</span>}
    </li>
  );
}
