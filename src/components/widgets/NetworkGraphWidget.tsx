'use client';

import React, { useState, useEffect, useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Zap, RefreshCw, ShieldCheck } from 'lucide-react';
import { useSystemStats } from '@/hooks/useSystemStats';
import { useConfig } from '@/hooks/useConfig';
import { useWidgetSize } from './WidgetContainer';

export default function NetworkGraphWidget({ editMode }: { editMode?: boolean }) {
  const { history } = useSystemStats();
  const { config } = useConfig();
  const { size: widgetSize } = useWidgetSize();
  const [isReady, setIsReady] = useState(false);
  const gradientId = `lat-${useId().replace(/:/g, '')}`;

  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handle = requestAnimationFrame(() => {
      timer = setTimeout(() => setIsReady(true), 300);
    });
    return () => {
      cancelAnimationFrame(handle);
      clearTimeout(timer);
    };
  }, []);

  if (!isReady || history.length === 0) return (
    <div className="nd-sidebar-card nd-animate-in" style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--nd-card-border)', borderTopColor: 'var(--nd-accent)', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  // Stats computation
  const latencies = history.map(h => h.latency).filter(l => typeof l === 'number');
  const currentLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
  const minPing = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxPing = latencies.length > 0 ? Math.max(...latencies) : 0;
  const avgPing = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  // RFC 1889 Jitter estimation: mean deviation of consecutive pings
  let jitter = 0;
  if (latencies.length > 1) {
    let diffSum = 0;
    for (let i = 1; i < latencies.length; i++) {
      diffSum += Math.abs(latencies[i] - latencies[i - 1]);
    }
    jitter = Math.round((diffSum / (latencies.length - 1)) * 10) / 10;
  }

  // Connection Quality Index Formula
  const qualityScore = Math.max(10, Math.min(100, Math.round(100 - (avgPing * 0.12) - (jitter * 1.2))));
  
  let netStatus = { label: 'Excellent', color: 'var(--nd-green)' };
  if (currentLatency > 150) netStatus = { label: 'Lent', color: 'var(--nd-red)' };
  else if (currentLatency > 80) netStatus = { label: 'Moyen', color: 'var(--nd-yellow)' };

  // Reusable Chart Component
  const renderChart = (height = 160) => (
    <div style={{ width: 'calc(100% + 20px)', marginLeft: -10, height, position: 'relative' }}>
      {/* Status overlay */}
      <div style={{
        position: 'absolute', top: 4, right: 16, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          backgroundColor: netStatus.color,
          boxShadow: `0 0 4px ${netStatus.color}`,
          flexShrink: 0
        }} />
        <span style={{
          fontSize: '0.65rem', fontWeight: 600,
          color: 'var(--nd-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {currentLatency}ms · {netStatus.label}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={history} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--nd-accent)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="var(--nd-accent)" stopOpacity={0.01}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--nd-card-border)" opacity={0.3} />
          <XAxis dataKey="time" hide={true} />
          <YAxis hide={true} domain={['dataMin - 5', 'dataMax + 20']} />
          <Tooltip
            cursor={{ stroke: 'var(--nd-card-border)', strokeWidth: 1, strokeDasharray: '4 4' }}
            contentStyle={{
              background: 'rgba(20, 20, 20, 0.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid var(--nd-card-border)',
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: 'var(--nd-text)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              padding: '8px 12px'
            }}
            itemStyle={{ color: 'var(--nd-accent)', fontWeight: 600 }}
            labelStyle={{ color: 'var(--nd-text-muted)', marginBottom: 4 }}
          />
          <Area 
            type="monotone" 
            dataKey="latency" 
            stroke="var(--nd-accent)" 
            strokeWidth={2.5} 
            fillOpacity={1} 
            fill={`url(#${gradientId})`} 
            activeDot={{ r: 4, fill: 'var(--nd-accent)', stroke: 'var(--nd-bg-surface)', strokeWidth: 2 }}
            name="Ping (ms)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  // Stat box sub-component
  const renderStatCard = (label: string, value: string | number, sub: string, icon: React.ReactNode) => (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: '8px 10px', borderRadius: 'var(--nd-card-radius)',
      background: 'rgba(255,255,255,0.01)', border: '1px solid var(--nd-card-border)',
      minWidth: 0,
      flex: 1
    }}>
      <span style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--nd-text)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', marginTop: 2 }}>
        {sub}
      </span>
    </div>
  );

  // ==================== WIDE LAYOUT ====================
  if (widgetSize === 'wide') {
    return (
      <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!hideTitles && (
          <div className="nd-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, flexShrink: 0 }}>
            <Activity size={12} style={{ color: 'var(--nd-accent)' }} /> 
            <span>Réseau & Latence</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 24, alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 60%', borderRight: '1px solid var(--nd-border)', paddingRight: 24 }}>
            {renderChart(180)}
          </div>
          <div style={{ flex: '1 1 40%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {renderStatCard('Moyenne', `${avgPing} ms`, `Min: ${minPing}ms / Max: ${maxPing}ms`, <RefreshCw size={10} />)}
              {renderStatCard('Gigotement / Jitter', `${jitter} ms`, 'Stabilité temporelle', <Activity size={10} />)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {renderStatCard('Qualité VPN', `${qualityScore}%`, qualityScore > 90 ? 'Liaison idéale' : qualityScore > 75 ? 'Liaison stable' : 'Liaison perturbée', <ShieldCheck size={10} style={{ color: qualityScore > 75 ? 'var(--nd-green)' : 'var(--nd-yellow)' }} />)}
              {renderStatCard('État actuel', `${currentLatency} ms`, netStatus.label, <Zap size={10} style={{ color: netStatus.color }} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MEDIUM LAYOUT ====================
  if (widgetSize === 'medium') {
    return (
      <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!hideTitles && (
          <div className="nd-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, flexShrink: 0 }}>
            <Activity size={12} style={{ color: 'var(--nd-accent)' }} /> 
            <span>Latence Réseau</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ flex: '1 1 60%' }}>
            {renderChart(140)}
          </div>
          <div style={{ flex: '1 1 40%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--nd-border)', paddingBottom: 4 }}>
              Statistiques Ping
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ color: 'var(--nd-text-muted)' }}>Moyenne:</span>
              <span style={{ fontWeight: 600 }}>{avgPing} ms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ color: 'var(--nd-text-muted)' }}>Gigue (Jitter):</span>
              <span style={{ fontWeight: 600 }}>{jitter} ms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ color: 'var(--nd-text-muted)' }}>Qualité:</span>
              <span style={{ fontWeight: 600, color: qualityScore > 75 ? 'var(--nd-green)' : 'var(--nd-yellow)' }}>{qualityScore}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== NARROW LAYOUT ====================
  return (
    <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!hideTitles && (
        <div className="nd-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexShrink: 0 }}>
          <Activity size={12} style={{ color: 'var(--nd-accent)' }} /> 
          <span>Latence Réseau</span>
        </div>
      )}
      {renderChart(160)}
    </div>
  );
}
