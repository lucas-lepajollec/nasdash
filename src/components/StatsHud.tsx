'use client';

import { Cpu, MemoryStick, HardDrive, Thermometer, Server, FolderOpen, Link2, Hash } from 'lucide-react';
import { SystemStats, Category } from '@/lib/types';

interface StatsHudProps {
  stats: SystemStats | null;
  categories?: Category[];
}

export default function StatsHud({ stats, categories }: StatsHudProps) {
  // Count services, links, ports from categories
  const serviceCount = categories?.reduce((acc, c) => acc + c.services.length, 0) || 0;
  const categoryCount = categories?.length || 0;
  const ports = new Set<string>();
  let linkCount = 0;
  categories?.forEach(cat => {
    cat.services.forEach(svc => {
      if (svc.localUrl) { linkCount++; try { const p = new URL(svc.localUrl).port; if (p) ports.add(p); } catch { /* */ } }
      if (svc.tailscaleUrl) { linkCount++; try { const p = new URL(svc.tailscaleUrl).port; if (p) ports.add(p); } catch { /* */ } }
    });
  });

  const cards = stats ? [
    {
      label: 'CPU',
      value: `${stats.cpu.load}%`,
      icon: <Cpu size={18} />,
      sub: stats.cpu.model,
    },
    {
      label: 'RAM',
      value: `${stats.ram.used}/${stats.ram.total} GB`,
      icon: <MemoryStick size={18} />,
      sub: `${stats.ram.percent}% utilisé`,
    },
    {
      label: 'Disque',
      value: stats.disk && stats.disk[0] ? `${stats.disk[0].percent}%` : 'N/A',
      icon: <HardDrive size={18} />,
      sub: stats.disk && stats.disk[0] ? `${stats.disk[0].used}/${stats.disk[0].total} GB` : '',
    },
    {
      label: 'Température',
      value: stats.temp.main >= 0 ? `${stats.temp.main}°C` : 'N/A',
      icon: <Thermometer size={18} />,
      sub: '',
    },
  ] : [
    { label: 'Services', value: `${serviceCount}`, icon: <Server size={18} />, sub: '' },
    { label: 'Catégories', value: `${categoryCount}`, icon: <FolderOpen size={18} />, sub: '' },
    { label: 'Liens Actifs', value: `${linkCount}`, icon: <Link2 size={18} />, sub: '' },
    { label: 'Ports', value: `${ports.size}`, icon: <Hash size={18} />, sub: '' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14,
      marginBottom: 28,
    }}>
      {cards.map((card, i) => (
        <div key={card.label} className={`nd-hud nd-animate-in nd-stagger-${i + 1}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span className="nd-hud-label">{card.label}</span>
            <span className="nd-hud-value">{card.value}</span>
            {card.sub && <span className="nd-hud-sub">{card.sub}</span>}
          </div>
          <div className="nd-hud-icon">{card.icon}</div>
        </div>
      ))}
    </div>
  );
}
