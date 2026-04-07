'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SystemMonitorProps {
  history: { cpu: number; latency: number; time: string }[];
  isDark: boolean;
}

import { useState, useEffect } from 'react';

export default function SystemMonitor({ history, isDark }: SystemMonitorProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Longer delay to ensure layout is settled and avoid Recharts 0-size warnings
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  // History can be empty on first ticks
  if (!ready || history.length === 0) return null;

  const currentLatency = history[history.length - 1].latency;
  let netStatus = { label: 'Excellent', color: 'var(--nd-green)' };
  if (currentLatency > 150) netStatus = { label: 'Connexion lente', color: 'var(--nd-red)' };
  else if (currentLatency > 80) netStatus = { label: 'Moyen', color: 'var(--nd-yellow)' };

  return (
    <div className="nd-animate-in" style={{ marginTop: 20, marginBottom: 20 }}>
      <div className="nd-monitor-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 10 }}>
        <span><span style={{ fontSize: '0.9rem' }}>📶</span> Latence Réseau</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 'normal' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: netStatus.color, boxShadow: `0 0 6px ${netStatus.color}` }} />
          <span style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', fontWeight: 600 }}>{netStatus.label} ({currentLatency}ms)</span>
        </div>
      </div>
      <div className="nd-card" style={{ height: 200, padding: '12px 8px', position: 'relative', width: '100%' }}>
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, bottom: 10 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: isDark ? '#7d8590' : '#656d76' }} />
              <YAxis
                domain={[0, 'dataMax + 20']}
                tick={{ fontSize: 9, fill: isDark ? '#7d8590' : '#656d76' }}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  background: isDark ? '#161b22' : '#fff',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  fontSize: '0.72rem',
                }}
              />
              <Line type="monotone" dataKey="latency" stroke="#a855f7" strokeWidth={2} dot={false} name="Ping (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
