'use client';

import { Server, FolderOpen, Hash, Link2 } from 'lucide-react';
import { Category } from '@/lib/types';
import { useConfig } from '@/hooks/useConfig';
import { useWidgetSize } from './WidgetContainer';

export default function QuickStatsWidget({ categories, editMode }: { categories: Category[], editMode?: boolean }) {
  const { config } = useConfig();
  const { size: widgetSize, width } = useWidgetSize();
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;

  // Compute stats
  const serviceCount = categories.reduce((acc, c) => acc + c.services.length, 0);
  const categoryCount = categories.length;
  const ports = new Set<string>();
  let linkCount = 0;
  categories.forEach(cat => {
    cat.services.forEach(svc => {
      if (svc.localUrl) {
        linkCount++;
        try { const p = new URL(svc.localUrl).port; if (p) ports.add(p); } catch { /* */ }
      }
      if (svc.tailscaleUrl) {
        linkCount++;
        try { const p = new URL(svc.tailscaleUrl).port; if (p) ports.add(p); } catch { /* */ }
      }
    });
  });

  const quickStats = [
    { label: 'Services', value: serviceCount, icon: <Server size={11} /> },
    { label: 'Catégories', value: categoryCount, icon: <FolderOpen size={11} /> },
    { label: 'Liens', value: linkCount, icon: <Link2 size={11} /> },
    { label: 'Ports', value: ports.size, icon: <Hash size={11} /> },
  ];

  // Grid layout columns based on container size
  let gridCols = '1fr 1fr';
  if (widgetSize === 'wide') {
    gridCols = 'repeat(4, 1fr)';
  } else if (widgetSize === 'narrow' && width < 220) {
    gridCols = '1fr';
  }

  return (
    <div className="nd-sidebar-card nd-animate-in">
      {!hideTitles && (
        <div className="nd-section-title">
          <Server size={12} style={{ color: 'var(--nd-accent)' }} />
          Vue d&apos;ensemble
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, marginTop: (hideTitles && !editMode) ? 0 : 8 }}>
        {quickStats.map((s) => (
          <div key={s.label} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 4px', borderRadius: 'var(--nd-card-radius)',
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)',
            minWidth: 0,
            transition: 'all 0.2s',
          }}
          className="nd-weather-card-hover"
          >
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--nd-accent)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
              {s.value}
            </span>
            <span style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 3, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>
              {s.icon} <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
