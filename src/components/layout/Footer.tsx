'use client';

import { Category } from '@/lib/types';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';

interface FooterProps {
  categories: Category[];
  showSecretSections: boolean;
  showSensitive: boolean;
  onToggleSecretSections: () => void;
}

export default function Footer({ categories, showSecretSections, showSensitive, onToggleSecretSections }: FooterProps) {
  const { t } = useI18n();
  const { user } = useConfig();
  const isAdmin = user?.role === 'admin';
  const ports = new Set<string>();

  (categories || []).forEach(cat => {
    cat.services?.forEach(svc => {
      [svc.localUrl, svc.tailscaleUrl].forEach(url => {
        if (!url) return;
        try { 
          let cleanUrl = url;
          if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'http://' + cleanUrl;
          }
          const p = new URL(cleanUrl).port; 
          if (p) ports.add(p); 
        } catch { /* */ }
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
          <span key={i} className="nd-port-pill">{!showSensitive ? '****' : port}</span>
        ))}
      </div>
      <div 
        onClick={isAdmin ? onToggleSecretSections : undefined}
        style={{ cursor: isAdmin ? 'pointer' : 'default', display: 'inline-block', marginTop: 8 }}
        title={isAdmin ? t("Activez ou désactivez les sections secrètes") : undefined}
      >
        <small style={{ opacity: 0.6, fontSize: '0.65rem', fontWeight: 500, letterSpacing: '2px', userSelect: 'none', color: 'var(--nd-text-muted)', textTransform: 'uppercase', transition: 'opacity 0.2s' }}>
          {t("NASDASH — Dashboard Privé")}
        </small>
      </div>
    </footer>
  );
}
