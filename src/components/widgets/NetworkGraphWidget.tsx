'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import { useSystemStats } from '@/hooks/useSystemStats';
import { useConfig } from '@/hooks/useConfig';

export default function NetworkGraphWidget({ editMode }: { editMode?: boolean }) {
  const { history } = useSystemStats();
  const { config } = useConfig();
  const [isReady, setIsReady] = useState(false);
  const gradientId = useRef(`lat-${Math.random().toString(36).substr(2, 9)}`).current;

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

  const currentLatency = history[history.length - 1]?.latency || 0;
  let netStatus = { label: 'Excellent', color: 'var(--nd-green)' };
  if (currentLatency > 150) netStatus = { label: 'Lent', color: 'var(--nd-red)' };
  else if (currentLatency > 80) netStatus = { label: 'Moyen', color: 'var(--nd-yellow)' };

  return (
    <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Title */}
      {!hideTitles && (
        <div className="nd-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexShrink: 0 }}>
          <Activity size={12} style={{ color: 'var(--nd-accent)' }} /> 
          <span>Latence Réseau</span>
        </div>
      )}

      {/* Chart — fixed pixel height, works everywhere */}
      <div style={{ width: 'calc(100% + 20px)', marginLeft: -10, height: 160, position: 'relative' }}>
        {/* Status — top right, no background, just subtle text */}
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
        <ResponsiveContainer width="100%" height={160}>
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
    </div>
  );
}
