'use client';

import React from 'react';
import { ArrowUpRight, Laptop, Loader2, Monitor, Server, Smartphone } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeWidget } from '../calme';
import { useTailscaleDevices } from './useTailscaleDevices';

function OsIcon({ os, hostname }: { os?: string; hostname?: string }) {
  const system = os?.toLowerCase() || '';
  const name = hostname?.toLowerCase() || '';
  if (system.includes('windows')) return <Monitor size={14} />;
  if (system.includes('ios') || system.includes('android') || name.includes('iphone') || name.includes('ipad')) return <Smartphone size={14} />;
  if (system.includes('mac') || name.includes('mac')) return <Laptop size={14} />;
  if (system.includes('linux')) return <Server size={14} />;
  return <Laptop size={14} />;
}

/**
 * Calme mesh: online devices first, each with its system, address (hidden
 * until sensitive data is shown) and a status dot; offline ones are dimmed.
 * Columns follow the block width. Same data and refresh as the Classic version.
 */
export default function CalmeTailscale({ editMode, showSensitive = false, isVisible = true }: { editMode?: boolean; showSensitive?: boolean; isVisible?: boolean }) {
  const { t } = useI18n();
  const { setSettingsModal } = useConfig();
  const { devices, error, unconfigured, loading } = useTailscaleDevices(isVisible);
  const admin = (
    <a className="ndc-link" href="https://login.tailscale.com/admin" target="_blank" rel="noopener noreferrer">
      {t('calme.adminConsole')} <ArrowUpRight size={11} />
    </a>
  );

  if (loading && !devices && !unconfigured && !error) {
    return <CalmeWidget title="Tailscale" editMode={editMode}><div className="ndc-empty"><Loader2 size={16} className="nd-spin" /></div></CalmeWidget>;
  }
  if (unconfigured) {
    return (
      <CalmeWidget title="Tailscale" editMode={editMode}>
        <div className="ndc-empty">
          <span>{t("Tailscale n'est pas configuré. Allez dans les paramètres pour lier votre compte.")}</span>
          {editMode && <button type="button" className="nd-btn nd-btn-accent" onClick={() => setSettingsModal({ open: true, targetTab: 'widget-tailscale' })}>{t('Configurer')}</button>}
        </div>
      </CalmeWidget>
    );
  }
  if (error) {
    return (
      <CalmeWidget title="Tailscale" editMode={editMode} aside={admin}>
        <div className="ndc-empty ndc-empty--error">{t('Démon indisponible ou configuration invalide')}</div>
      </CalmeWidget>
    );
  }
  if (!devices || devices.length === 0) return null;

  const sorted = [...devices].sort((a, b) => Number(b.online) - Number(a.online) || String(a.hostname).localeCompare(String(b.hostname)));
  const online = devices.filter(device => device.online).length;

  return (
    <CalmeWidget title="Tailscale" editMode={editMode} aside={<>{`${online}/${devices.length}`} · {admin}</>}>
      <ul className="ndc-mesh">
        {sorted.map(device => (
          <li key={device.id} className={`ndc-mesh-device ${device.online ? '' : 'is-offline'}`}>
            <span className="ndc-mesh-icon"><OsIcon os={device.os} hostname={device.hostname} /></span>
            <span className="ndc-mesh-text">
              <span className="ndc-mesh-name">
                <span title={device.hostname}>{device.hostname}</span>
                {device.isSelf && <span className="ndc-tag">{t('calme.thisHost')}</span>}
              </span>
              <span className="ndc-mesh-sub">{[showSensitive ? device.ip : '•••', device.os].filter(Boolean).join(' · ')}</span>
            </span>
            <span className={`ndc-dot ${device.online ? 'ndc-dot--online' : ''}`} title={device.online ? t('En ligne') : t('Hors ligne')} />
          </li>
        ))}
      </ul>
    </CalmeWidget>
  );
}
