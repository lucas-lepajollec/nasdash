'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect, useRef } from 'react';

interface SystemMonitorProps {
  history: any[];
  isDark?: boolean;
  isVisible: boolean;
}

export default function SystemMonitor({ history, isDark = true, isVisible }: SystemMonitorProps) {
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // We wait for the next frame and layout to be stable
    const handle = requestAnimationFrame(() => {
      const timer = setTimeout(() => setIsReady(true), 500);
      return () => clearTimeout(timer);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  // Stop rendering if parent is hidden, but AFTER hooks to avoid React errors
  if (!isVisible) return null;

  // History can be empty on first ticks
  if (!isReady || history.length === 0) return (
    <div style={{ height: 240, marginTop: 20, marginBottom: 20 }} />
  );

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
      <div className="nd-card" ref={containerRef} style={{ height: 200, padding: '12px 8px', position: 'relative', width: '100%', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, bottom: 10 }}>
          <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
            <LineChart data={history} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 9, fill: isDark ? '#7d8590' : '#656d76' }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 'dataMax + 20']}
                tick={{ fontSize: 9, fill: isDark ? '#7d8590' : '#656d76' }}
                width={28}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: isDark ? '#161b22' : '#fff',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  fontSize: '0.72rem',
                }}
              />
              <Line 
                type="monotone" 
                dataKey="latency" 
                stroke="#a855f7" 
                strokeWidth={2} 
                dot={false} 
                activeDot={{ r: 4, fill: '#a855f7' }}
                name="Ping (ms)" 
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
