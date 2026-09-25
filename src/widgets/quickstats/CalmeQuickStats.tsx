'use client';

import type { Category } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeWidget } from '../calme';
import { quickStats } from './stats';

/**
 * Calme overview: the number of services in large, then the other counts on
 * one quiet line.
 */
export default function CalmeQuickStats({ categories, editMode }: { categories: Category[]; editMode?: boolean }) {
  const { t } = useI18n();
  const stats = quickStats(categories);
  const others = [
    { label: t('Catégories'), value: stats.categories },
    { label: t('Liens'), value: stats.links },
    { label: t('Ports'), value: stats.ports },
  ];
  return (
    <CalmeWidget title={t('Vue d&apos;ensemble')} editMode={editMode}>
      <div className="ndc-overview">
        <div className="ndc-overview-main">
          <span className="ndc-overview-value">{stats.services}</span>
          <span className="ndc-overview-label">{t('Services')}</span>
        </div>
        <dl className="ndc-overview-others">
          {others.map(item => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </CalmeWidget>
  );
}
