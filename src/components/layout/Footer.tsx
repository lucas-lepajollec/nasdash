'use client';

import { Category } from '@/lib/types';

interface FooterProps {
  categories: Category[];
  showSecret: boolean;
  onToggleSecret: () => void;
}

export default function Footer({ categories, showSecret, onToggleSecret }: FooterProps) {
  const ports = new Set<string>();
  categories.forEach(cat => {
    cat.services.forEach(svc => {
      [svc.localUrl, svc.tailscaleUrl].forEach(url => {
        if (!url) return;
        try { const p = new URL(url).port; if (p) ports.add(p); } catch { /* */ }
      });
    });
  });

  const sortedPorts = Array.from(ports).sort((a, b) => Number(a) - Number(b));

  // Insert secret trigger among ports (invisible)
  // Place it roughly in the middle of the port list
  const triggerIndex = Math.floor(sortedPorts.length / 2);

  return (
    <footer style={{ borderTop: '1px solid var(--nd-card-border)', paddingTop: 16, marginTop: 32, textAlign: 'center' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginBottom: 12 }}>
        {sortedPorts.map((port, i) => (
          <span key={i} className="nd-port-pill">{!showSecret ? '****' : port}</span>
        ))}
      </div>
      <div 
        onClick={onToggleSecret}
        style={{ cursor: 'pointer', display: 'inline-block' }}
        title=" "
      >
        <small style={{ opacity: 0.3, fontSize: '0.6rem', letterSpacing: 1, userSelect: 'none' }}>NASDASH — Dashboard Privé</small>
      </div>
    </footer>
  );
}
