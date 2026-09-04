'use client';

import React, { useState, useEffect } from 'react';
import { Monitor, Laptop, Smartphone, Server, Loader2, AlertCircle, Globe } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useWidgetSize } from './WidgetContainer';
import { useI18n } from '@/i18n/I18nProvider';

const getOsIcon = (os: string, hostname: string) => {
  const lower = os?.toLowerCase() || '';
  const hn = hostname?.toLowerCase() || '';
  if (lower.includes('windows')) return <Monitor size={12} color="#00a4ef" />;
  if (lower.includes('mac') || hn.includes('mac')) return <Laptop size={12} color="#60a5fa" />;
  if (lower.includes('ios') || hn.includes('iphone') || hn.includes('ipad')) return <Smartphone size={12} color="#c084fc" />;
  if (lower.includes('android')) return <Smartphone size={12} color="#4ade80" />;
  if (lower.includes('linux')) return <Server size={12} color="#fb923c" />;
  return <Laptop size={12} color="#9ca3af" />;
};

export default function TailscaleWidget({ editMode, showSensitive = false, isVisible = true }: { editMode?: boolean; showSensitive?: boolean; isVisible?: boolean }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { size: widgetSize } = useWidgetSize();
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;
  const [devices, setDevices] = useState<any[] | null>(null);
  const [error, setError] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTS = async () => {
    try {
      const res = await fetch('/api/tailscale');
      const data = await res.json();
      
      if (data.unconfigured) {
        setUnconfigured(true);
        setError(false);
      } else if (data.error) {
        setError(true);
        setUnconfigured(false);
      } else {
        setDevices(data.devices || []);
        setUnconfigured(false);
        setError(false);
      }
    } catch (e) {
      setError(true);
      setUnconfigured(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isVisible) return;
    fetchTS();
    const interval = setInterval(fetchTS, 60000);
    return () => clearInterval(interval);
  }, [isVisible]);

  if (loading && !devices && !unconfigured && !error) {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Loader2 size={16} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (unconfigured) {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
        {!hideTitles && (
          <div className="nd-section-title">
            <Globe size={12} style={{ color: 'var(--nd-purple)' }} /> Tailscale
          </div>
        )}
        <p style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', margin: 0, padding: '8px 4px' }}>
          {t("Tailscale n'est pas configuré. Allez dans les paramètres pour lier votre compte.")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
        {!hideTitles && (
          <div className="nd-section-title" style={{ color: 'var(--nd-red)' }}>
            <AlertCircle size={12} /> {t("Tailscale Error")}
          </div>
        )}
        <a href="https://login.tailscale.com/admin" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--nd-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: hideTitles ? 0 : 4, marginBottom: 8 }}>
          <Globe size={10} /> {t("Dashboard Tailscale")}
        </a>
        <p style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', margin: 0, padding: 4 }}>{t("Démon indisponible ou configuration invalide")}</p>
      </div>
    );
  }

  if (!devices || devices.length === 0) return null;

  // ==================== WIDE LAYOUT (TABLE VIEW) ====================
  if (widgetSize === 'wide') {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
        {!hideTitles && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div className="nd-section-title" style={{ flex: 1 }}>
              <Globe size={12} style={{ color: 'var(--nd-purple)' }} /> {t("Tailscale VPN")}
            </div>
            <a href="https://login.tailscale.com/admin" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--nd-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Globe size={10} /> {t("Admin Panel")}
            </a>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', marginTop: 8 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--nd-border)', color: 'var(--nd-text-muted)', textAlign: 'left' }}>
              <th style={{ padding: '6px 10px', fontWeight: 600 }}>Appareil</th>
              <th style={{ padding: '6px 10px', fontWeight: 600 }}>{t("Adresse IP")}</th>
              <th style={{ padding: '6px 10px', fontWeight: 600 }}>{t("Système")}</th>
              <th style={{ padding: '6px 10px', fontWeight: 600, textAlign: 'right' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device: any) => (
              <tr key={device.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', verticalAlign: 'middle' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {device.hostname}
                    {device.isSelf && <span style={{ fontSize: '0.55rem', padding: '1px 4px', background: 'rgba(255,255,255,0.06)', borderRadius: 4, color: 'var(--nd-text-muted)', textTransform: 'uppercase' }}>{t("Hôte")}</span>}
                  </div>
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--nd-text-muted)' }}>
                  {!showSensitive ? '•••' : device.ip}
                </td>
                <td style={{ padding: '8px 10px', color: 'var(--nd-text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getOsIcon(device.os, device.hostname)}
                    <span style={{ fontSize: '0.68rem' }}>{device.os || 'Linux'}</span>
                  </div>
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.65rem', color: device.online ? 'var(--nd-green)' : 'var(--nd-text-muted)', fontWeight: 600 }}>
                      {device.online ? t("En ligne") : t("Hors ligne")}
                    </span>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: device.online ? 'var(--nd-green)' : 'var(--nd-border)',
                      boxShadow: device.online ? '0 0 8px var(--nd-green)' : 'none',
                    }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ==================== MEDIUM LAYOUT (GRID VIEW) ====================
  if (widgetSize === 'medium') {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
        {!hideTitles && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="nd-section-title" style={{ flex: 1, margin: 0 }}>
              <Globe size={12} style={{ color: 'var(--nd-purple)' }} /> Tailscale
            </div>
            <a href="https://login.tailscale.com/admin" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--nd-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Globe size={10} /> Dashboard
            </a>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {devices.map((device: any) => (
            <div key={device.id} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '8px 10px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--nd-card-border)',
              borderRadius: 'var(--nd-card-radius)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                <div style={{ opacity: 0.8, display: 'flex', marginTop: 3 }}>{getOsIcon(device.os, device.hostname)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--nd-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {device.hostname}
                    {device.isSelf && <span style={{ fontSize: '0.5rem', padding: '1px 3px', background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>{t("Hôte")}</span>}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', fontFamily: 'monospace' }}>{!showSensitive ? '•••' : device.ip}</div>
                </div>
              </div>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: device.online ? 'var(--nd-green)' : 'var(--nd-border)',
                boxShadow: device.online ? '0 0 8px var(--nd-green)' : 'none',
                opacity: device.online ? 1 : 0.4,
                flexShrink: 0
              }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ==================== NARROW LAYOUT (LIST VIEW - DEFAULT) ====================
  return (
    <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
      {!hideTitles && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="nd-section-title" style={{ flex: 1 }}>
            <Globe size={12} style={{ color: 'var(--nd-purple)' }} /> Tailscale
          </div>
        </div>
      )}
      <a href="https://login.tailscale.com/admin" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.65rem', color: 'var(--nd-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: hideTitles ? 0 : 4, marginBottom: 8 }}>
        <Globe size={10} /> {t("Dashboard Tailscale")}
      </a>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {devices.map((device: any) => (
          <div key={device.id} className="nd-ts-device" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
              <div style={{ opacity: 0.8, display: 'flex', marginTop: 3 }}>{getOsIcon(device.os, device.hostname)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div className="nd-ts-device-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {device.hostname}
                  {device.isSelf && <span style={{ fontSize: '0.55rem', padding: '1px 4px', background: 'rgba(255,255,255,0.06)', borderRadius: 4, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t("Hôte")}</span>}
                </div>
                <div className="nd-ts-device-os">{!showSensitive ? '•••' : device.ip}</div>
              </div>
            </div>
            <div className="nd-ts-status" style={{
              background: device.online ? 'var(--nd-green)' : 'var(--nd-border)',
              boxShadow: device.online ? '0 0 8px var(--nd-green)' : 'none',
              opacity: device.online ? 1 : 0.4
            }} title={device.online ? t("En ligne") : t("Hors ligne")} />
          </div>
        ))}
      </div>
    </div>
  );
}
