'use client';

import { Server, FolderOpen, Hash, Link2, Globe } from 'lucide-react';
import { Category } from '@/lib/types';
import TailscaleStatus from './TailscaleStatus';

interface RightSidebarProps {
  categories: Category[];
  editMode?: boolean;
}

export default function RightSidebar({ categories, editMode }: RightSidebarProps) {
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

  return (
    <aside className="nd-sidebar-right">
      {/* Quick Stats */}
      <div className="nd-sidebar-card nd-animate-in">
        <div className="nd-section-title">
          <Server size={12} style={{ color: 'var(--nd-accent)' }} />
          Vue d&apos;ensemble
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {quickStats.map((s) => (
            <div key={s.label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '8px 4px', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)',
            }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--nd-accent)', fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 3 }}>
                {s.icon} {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <TailscaleStatus editMode={editMode} />
    </aside>
  );
}
