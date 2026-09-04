'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, X, Cpu, HardDrive, Wifi, BarChart3, Clock, Layers } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';

interface PerfMetrics {
  fps: number;
  memoryUsed: number;   // MB
  memoryTotal: number;  // MB
  domNodes: number;
  reactRenders: number;
  networkRequests: number;
  avgResponseTime: number;
  jsHeapUsed: number;  // MB
  jsHeapLimit: number; // MB
}

// Global render counter (incremented by the component on each render)
let globalRenderCount = 0;

// Network interceptor
function getNetworkStats() {
  if (typeof window === 'undefined') return { count: 0, totalTime: 0, lastReset: Date.now() };
  if (!(window as any).__perfNetworkStats) {
    (window as any).__perfNetworkStats = { count: 0, totalTime: 0, lastReset: Date.now() };
  }
  return (window as any).__perfNetworkStats;
}

function interceptFetch() {
  if (typeof window === 'undefined') return;
  if ((window as any).__perfFetchIntercepted) return;
  (window as any).__perfFetchIntercepted = true;

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const start = performance.now();
    try {
      const response = await originalFetch.apply(window, args as any);
      const elapsed = performance.now() - start;
      getNetworkStats().count++;
      getNetworkStats().totalTime += elapsed;
      return response;
    } catch (e) {
      const elapsed = performance.now() - start;
      getNetworkStats().count++;
      getNetworkStats().totalTime += elapsed;
      throw e;
    }
  };
}

export default function PerfMonitor() {
  const { t, locale } = useI18n();
  const { config } = useConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState<PerfMetrics>({
    fps: 0, memoryUsed: 0, memoryTotal: 0, domNodes: 0,
    reactRenders: 0, networkRequests: 0, avgResponseTime: 0,
    jsHeapUsed: 0, jsHeapLimit: 0,
  });
  const [history, setHistory] = useState<{ fps: number; mem: number; time: string }[]>([]);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const animFrameRef = useRef<number>(0);
  const prevRenderRef = useRef(0);

  // Track renders
  globalRenderCount++;

  useEffect(() => {
    interceptFetch();
  }, []);

  const measure = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;

    if (elapsed >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / elapsed);
      frameCountRef.current = 0;
      lastTimeRef.current = now;

      // DOM nodes
      const domNodes = document.querySelectorAll('*').length;

      // Memory (Chrome/Edge only)
      let memoryUsed = 0, memoryTotal = 0, jsHeapUsed = 0, jsHeapLimit = 0;
      const perf = performance as any;
      if (perf.memory) {
        jsHeapUsed = Math.round(perf.memory.usedJSHeapSize / 1024 / 1024 * 10) / 10;
        jsHeapLimit = Math.round(perf.memory.jsHeapSizeLimit / 1024 / 1024 * 10) / 10;
        memoryUsed = jsHeapUsed;
        memoryTotal = jsHeapLimit;
      }

      // React renders delta
      const renderDelta = globalRenderCount - prevRenderRef.current;
      prevRenderRef.current = globalRenderCount;

      // Network
      const currentNetworkStats = getNetworkStats();
      const timeSinceReset = (Date.now() - currentNetworkStats.lastReset) / 1000;
      const reqPerSec = timeSinceReset > 0 ? currentNetworkStats.count / timeSinceReset : 0;
      const avgResponse = currentNetworkStats.count > 0 ? currentNetworkStats.totalTime / currentNetworkStats.count : 0;

      const newMetrics: PerfMetrics = {
        fps,
        memoryUsed,
        memoryTotal,
        domNodes,
        reactRenders: renderDelta,
        networkRequests: Math.round(reqPerSec * 10) / 10,
        avgResponseTime: Math.round(avgResponse),
        jsHeapUsed,
        jsHeapLimit,
      };

      setMetrics(newMetrics);

      if (isOpen) {
        setHistory(prev => {
          const time = new Date().toLocaleTimeString(locale, { second: '2-digit', minute: '2-digit' });
          const next = [...prev, { fps, mem: memoryUsed, time }];
          return next.slice(-30);
        });
      }
    }

    frameCountRef.current++;
    animFrameRef.current = requestAnimationFrame(measure);
  }, [isOpen, locale]);

  useEffect(() => {
    if (isOpen) {
      // Reset network stats when opening
      const currentNetworkStats = getNetworkStats();
      currentNetworkStats.count = 0;
      currentNetworkStats.totalTime = 0;
      currentNetworkStats.lastReset = Date.now();
      animFrameRef.current = requestAnimationFrame(measure);
      return () => cancelAnimationFrame(animFrameRef.current);
    }
  }, [isOpen, measure]);

  const getColor = (value: number, thresholds: [number, number]) => {
    if (value >= thresholds[1]) return 'var(--nd-red)';
    if (value >= thresholds[0]) return 'var(--nd-yellow)';
    return 'var(--nd-green)';
  };

  const getFpsColor = (fps: number) => {
    if (fps >= 50) return 'var(--nd-green)';
    if (fps >= 30) return 'var(--nd-yellow)';
    return 'var(--nd-red)';
  };

  if (!config?.settings?.enablePerfMonitor) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title={t("Performance Monitor")}
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 99999,
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--nd-card-bg)', border: '1px solid var(--nd-card-border)',
          color: 'var(--nd-accent)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)', transition: 'all 0.2s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = 'var(--nd-accent-glow)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'var(--nd-card-bg)'; }}
      >
        <Activity size={16} />
      </button>
    );
  }

  const memPercent = metrics.memoryTotal > 0 ? (metrics.memoryUsed / metrics.memoryTotal) * 100 : 0;

  const statItems = [
    { icon: <BarChart3 size={12} />, label: 'FPS', value: `${metrics.fps}`, color: getFpsColor(metrics.fps), detail: '≥50 = OK' },
    { icon: <HardDrive size={12} />, label: t("JS Heap"), value: `${metrics.jsHeapUsed} MB`, color: getColor(memPercent, [60, 80]), detail: `/ ${metrics.jsHeapLimit} MB (${Math.round(memPercent)}%)` },
    { icon: <Layers size={12} />, label: t("DOM Nodes"), value: `${metrics.domNodes}`, color: getColor(metrics.domNodes, [1500, 3000]), detail: '< 1500 = OK' },
    { icon: <Cpu size={12} />, label: 'Re-renders/s', value: `${metrics.reactRenders}`, color: getColor(metrics.reactRenders, [5, 15]), detail: '< 5 = OK' },
    { icon: <Wifi size={12} />, label: t("Req. réseau/s"), value: `${metrics.networkRequests}`, color: getColor(metrics.networkRequests, [3, 8]), detail: '< 3 = OK' },
    { icon: <Clock size={12} />, label: t("Latence API"), value: `${metrics.avgResponseTime} ms`, color: getColor(metrics.avgResponseTime, [200, 1000]), detail: '< 200ms = OK' },
  ];

  // Simple mini sparkline
  const maxFps = Math.max(60, ...history.map(h => h.fps));
  const maxMem = Math.max(100, ...history.map(h => h.mem));

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 99999,
      width: 320, maxHeight: '80vh', overflow: 'auto',
      background: 'var(--nd-card-bg)', border: '1px solid var(--nd-card-border)',
      borderRadius: 'var(--nd-card-radius)', backdropFilter: 'blur(20px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      fontFamily: 'var(--font-global), system-ui, sans-serif',
      transition: 'all 0.3s ease-out'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid var(--nd-card-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={14} style={{ color: 'var(--nd-accent)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nd-text)', letterSpacing: 0.5 }}>
            {t("PERF MONITOR")}
          </span>
          <span style={{
            fontSize: '0.55rem', padding: '2px 6px', borderRadius: 4,
            background: 'var(--nd-accent-glow)', color: 'var(--nd-accent)',
            fontWeight: 600, textTransform: 'uppercase',
          }}>
            LIVE
          </span>
        </div>
        <button
          onClick={() => { setIsOpen(false); setHistory([]); }}
          style={{
            background: 'none', border: 'none', color: 'var(--nd-text-muted)',
            cursor: 'pointer', display: 'flex', padding: 2,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {statItems.map(item => (
          <div key={item.label} style={{
            padding: '10px 10px', borderRadius: 'var(--nd-card-radius)',
            background: 'rgba(128, 128, 128, 0.05)', border: '1px solid var(--nd-card-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <span style={{ color: 'var(--nd-text-muted)', display: 'flex' }}>{item.icon}</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--nd-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {item.label}
              </span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>
              {item.value}
            </div>
            <div style={{ fontSize: '0.5rem', color: 'var(--nd-text-muted)', marginTop: 2 }}>
              {item.detail}
            </div>
          </div>
        ))}
      </div>

      {/* Mini Sparkline */}
      {history.length > 2 && (
        <div style={{ padding: '8px 14px 12px' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--nd-text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {t("Historique FPS & Mémoire (30s)")}
          </div>
          <svg width="100%" height="50" viewBox={`0 0 ${history.length - 1} 50`} preserveAspectRatio="none" style={{ borderRadius: 6, background: 'rgba(128, 128, 128, 0.05)' }}>
            {/* FPS line */}
            <polyline
              fill="none"
              stroke="var(--nd-green)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              points={history.map((h, i) => `${i},${50 - (h.fps / maxFps) * 45}`).join(' ')}
            />
            {/* Memory line */}
            <polyline
              fill="none"
              stroke="var(--nd-purple, #a855f7)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeDasharray="3 2"
              points={history.map((h, i) => `${i},${50 - (h.mem / maxMem) * 45}`).join(' ')}
            />
          </svg>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: '0.5rem', color: 'var(--nd-green)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 2, background: 'var(--nd-green)', borderRadius: 1 }} /> FPS
            </span>
            <span style={{ fontSize: '0.5rem', color: 'var(--nd-purple, #a855f7)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 2, background: 'var(--nd-purple, #a855f7)', borderRadius: 1, borderTop: '1px dashed' }} /> {t("Mémoire")}
            </span>
          </div>
        </div>
      )}

      {/* Verdict */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--nd-card-border)',
        fontSize: '0.6rem', color: 'var(--nd-text-muted)',
      }}>
        {metrics.fps >= 50 && metrics.reactRenders < 5 && memPercent < 60 ? (
          <span style={{ color: 'var(--nd-green)' }}>{t("✅ Performances excellentes")}</span>
        ) : metrics.fps >= 30 && metrics.reactRenders < 15 && memPercent < 80 ? (
          <span style={{ color: 'var(--nd-yellow)' }}>{t("⚠️ Performances acceptables")}</span>
        ) : (
          <span style={{ color: 'var(--nd-red)' }}>{t("🔴 Performances dégradées — vérifier les fuites")}</span>
        )}
      </div>
    </div>
  );
}
