'use client';

import React, { useState } from 'react';
import { RotateCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { VPN_TUNNEL_TYPES, type VpnTunnelSummary } from '@/lib/widgetData/contracts';
import { demoFetch } from '@/lib/demoTransport';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { CalmeWidget } from '../calme';
import { DataError, useWidgetData, WidgetDataError, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { Stat } from '@/components/widgets/media/visual';

/**
 * A VPN gateway (Gluetun): whether the tunnel holds, where traffic leaves it
 * (city, country, address, network) and the port the provider forwards. An
 * administrator can restart the tunnel. The address and the port can be hidden.
 */
export default function CalmeVpn({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const connection = chosenConnection(config?.integrations, VPN_TUNNEL_TYPES, settings.integrationId);
  const { data, error, mutate, stale } = useWidgetData<VpnTunnelSummary>('/api/widgets/vpn', widgetId, settings, { refreshMs: 15_000, isVisible, method: 'GET', enabled: !!connection });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const title = t('widget.vpn.name');

  const restart = async () => {
    setBusy(true); setFailed(null);
    try {
      const response = await demoFetch('/api/widgets/vpn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ widgetId, action: 'restart' }) });
      const answer = await response.json().catch(() => null) as (VpnTunnelSummary & { error?: string }) | null;
      if (!response.ok || !answer) throw new WidgetDataError(answer?.error || 'widgets.error.network', response.status);
      void mutate(answer, { revalidate: false });
    } catch (cause) { setFailed(cause instanceof WidgetDataError ? cause.key : 'widgets.error.network'); }
    finally { setBusy(false); }
  };

  const action = data?.canControl ? (
    <button type="button" className="ndc-icon-button" disabled={busy} onClick={() => setConfirm(true)} aria-label={t('widgets.vpn.restart')} title={t('widgets.vpn.restart')}>
      {busy ? <span className="nd-spinner" style={{ width: 11, height: 11 }} aria-hidden="true" /> : <RotateCw size={12} />}
    </button>
  ) : undefined;

  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings}>
          {(draft, change) => (
            <>
              <CalmeField label={t('widgets.connection')}>
                <ConnectionPicker types={VPN_TUNNEL_TYPES} section="tunnel" value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id })} />
              </CalmeField>
              <CalmeRow label={t('widgets.vpn.showAddress')}>
                <CalmeSwitch label={t('widgets.vpn.showAddress')} checked={draft.address !== false} onChange={on => change({ address: on ? null : false })} />
              </CalmeRow>
              <CalmeRow label={t('widgets.vpn.showPort')}>
                <CalmeSwitch label={t('widgets.vpn.showPort')} checked={draft.port !== false} onChange={on => change({ port: on ? null : false })} />
              </CalmeRow>
              <CalmeRow label={t('widgets.vpn.showServices')} info={t('widgets.vpn.showServicesHint')}>
                <CalmeSwitch label={t('widgets.vpn.showServices')} checked={draft.services !== false} onChange={on => change({ services: on ? null : false })} />
              </CalmeRow>
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <SetupGuide kind="tunnel" />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 40 }} /><span className="ndw-skeleton-row" style={{ height: 36 }} /></div>
              : <Tunnel data={data} address={settings.address !== false} port={settings.port !== false} services={settings.services !== false} action={action} />}
        {failed && <p className="ndw-note ndw-down" role="alert">{t(failed)}</p>}
      </div>
      <ConfirmModal isOpen={confirm} onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void restart(); }}
        title={t('widgets.vpn.restart')} description={t('widgets.vpn.restartConfirm', { name: data?.name ?? '' })} confirmLabel={t('widgets.vpn.restartAction')} cancelLabel={t('Annuler')} />
    </CalmeWidget>
  );
}

function Tunnel({ data, address, port, services, action }: { data: VpnTunnelSummary; address: boolean; port: boolean; services: boolean; action?: React.ReactNode }) {
  const { t } = useI18n();
  // Running but with no exit address yet: Gluetun is still checking the connection.
  const state = data.status === 'running' && !data.publicIp ? 'connecting' : data.status === 'running' ? 'connected' : data.status;
  const down = state === 'stopped' || state === 'crashed' || state === 'unknown';
  const place = data.city ?? data.region ?? data.country;
  const ports = port ? data.forwardedPorts ?? [] : [];
  return (
    <div className="ndw-vpn">
      {/* Inside the widget, not in its title: titles can be hidden. */}
      <div className="ndw-vpn-head">
        <span className={`ndw-vpn-state ${down ? 'is-down' : state === 'connected' ? '' : 'is-pending'}`}>
          {down ? <ShieldAlert size={13} aria-hidden="true" /> : <ShieldCheck size={13} aria-hidden="true" />}
          <span className="ndw-vpn-name">{data.name}</span>
          <span className="ndw-vpn-word">{t(`widgets.vpn.state.${state}`)}</span>
        </span>
        {action}
      </div>
      {state === 'connected' && (
        <>
          {place && (
            <span className="ndw-vpn-place">
              <span className="ndw-vpn-city">{place}</span>
              {data.country && data.country !== place && <span className="ndw-vpn-country">{data.country}</span>}
            </span>
          )}
          {(address || ports.length > 0) && (
            <div className="ndw-mx-statrow">
              {address && data.publicIp && <Stat value={<span className="ndw-vpn-ip">{data.publicIp}</span>} label={t('widgets.vpn.address')} />}
              {ports.length > 0 && <Stat value={ports.join(', ')} label={t(ports.length > 1 ? 'widgets.vpn.ports' : 'widgets.vpn.port')} />}
            </div>
          )}
          {data.organization && <span className="ndw-media-sub ndw-vpn-org" title={data.organization}>{data.organization}</span>}
        </>
      )}
      {services && (data.services?.length ?? 0) > 0 && (
        <div className="ndw-vpn-services">
          <span className="ndw-mx-label">{t('widgets.vpn.services')}</span>
          <span className="ndw-vpn-service-list">
            {data.services!.map(service => <span key={service.name} className={service.running ? '' : 'is-off'} title={service.running ? undefined : t('widgets.vpn.serviceStopped')}>{service.name}</span>)}
          </span>
        </div>
      )}
      {/* Said even when the list is hidden: these services have no network at all. */}
      {(data.detached?.length ?? 0) > 0 && <p className="ndw-note ndw-vpn-detached" role="alert">{t('widgets.vpn.detached', { names: data.detached!.join(', ') })}</p>}
    </div>
  );
}
