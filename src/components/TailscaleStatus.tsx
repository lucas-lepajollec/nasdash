'use client';

import React, { useState, useEffect } from 'react';
import { Monitor, Laptop, Smartphone, Server, Loader2, AlertCircle, Globe } from 'lucide-react';

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

export default function TailscaleStatus() {
  const [devices, setDevices] = useState<any[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTS = async () => {
      try {
        const res = await fetch('/api/tailscale');
        const data = await res.json();
        if (data.error) setError(true);
        else setDevices(data);
      } catch (e) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchTS();
    const interval = setInterval(fetchTS, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Loader2 size={16} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
        <div className="nd-section-title" style={{ color: 'var(--nd-red)' }}>
          <AlertCircle size={12} />
          Tailscale Error
        </div>
        <p style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', margin: 0, padding: 4 }}>Démon indisponible ou bloqué</p>
      </div>
    );
  }
  
  if (!devices || devices.length === 0) return null;

  return (
    <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
      <div className="nd-section-title">
        <Globe size={12} style={{ color: 'var(--nd-purple)' }} />
        Tailscale
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {devices.map((device: any) => (
          <div key={device.id} className="nd-ts-device" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
              <div style={{ opacity: 0.8, display: 'flex', marginTop: 3 }}>{getOsIcon(device.os, device.hostname)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div className="nd-ts-device-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {device.hostname}
                  {device.isSelf && <span style={{ fontSize: '0.55rem', padding: '1px 4px', background: 'rgba(255,255,255,0.06)', borderRadius: 4, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Hôte</span>}
                </div>
                <div className="nd-ts-device-os">{device.ip}</div>
              </div>
            </div>
            <div className="nd-ts-status" style={{ 
              background: device.online ? 'var(--nd-green)' : 'var(--nd-border)',
              boxShadow: device.online ? '0 0 8px var(--nd-green)' : 'none',
              opacity: device.online ? 1 : 0.4
            }} title={device.online ? 'En ligne' : 'Hors ligne'} />
          </div>
        ))}
      </div>
    </div>
  );
}
