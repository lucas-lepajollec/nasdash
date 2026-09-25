'use client';

import { Server, FolderOpen, Hash, Link2 } from 'lucide-react';
import { Category } from '@/lib/types';
import { useConfig } from '@/hooks/useConfig';
import { useWidgetSize } from './WidgetContainer';
import { useI18n } from '@/i18n/I18nProvider';
import { quickStats } from '@/widgets/quickstats/stats';

export default function QuickStatsWidget({ categories, editMode }: { categories: Category[], editMode?: boolean }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { size: widgetSize, width } = useWidgetSize();
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;

  const { services: serviceCount, categories: categoryCount, links: linkCount, ports } = quickStats(categories);

  const cards = [
    { label: t("Services"), value: serviceCount, icon: <Server size={11} /> },
    { label: t("Catégories"), value: categoryCount, icon: <FolderOpen size={11} /> },
    { label: t("Liens"), value: linkCount, icon: <Link2 size={11} /> },
    { label: t("Ports"), value: ports, icon: <Hash size={11} /> },
  ];

  // Grid layout columns based on container size
  let gridCols = '1fr 1fr';
  if (widgetSize === 'wide') {
    gridCols = 'repeat(4, 1fr)';
  } else if (widgetSize === 'narrow' && width < 160) {
    gridCols = '1fr';
  }

  return (
    <div className="nd-sidebar-card nd-animate-in">
      {(!hideTitles || editMode) && (
        <div className="nd-section-title">
          <Server size={12} style={{ color: 'var(--nd-accent)' }} />
          {t("Vue d&apos;ensemble")}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, marginTop: hideTitles ? 0 : 8 }}>
        {cards.map((s) => (
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
