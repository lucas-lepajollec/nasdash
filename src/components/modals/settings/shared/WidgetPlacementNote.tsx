import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { usePages } from '@/providers/PagesProvider';
import { useCalme } from '@/widgets/calme';
import { CalmeInfo } from './CalmeControls';

/**
 * Widgets no longer have a global on/off switch: a widget exists where it is
 * placed. This note tells where a widget type is used and how to change it.
 */
export function WidgetPlacementNote({ type }: { type: string }) {
  const { t } = useI18n();
  const { pages } = usePages();
  const usage = pages
    .map(page => ({ page, count: page.widgets.filter(widget => widget.type === type && !widget.hidden).length }))
    .filter(entry => entry.count > 0);
  const calme = useCalme();

  // Calme: one quiet line, the pages as small tags, the hint below.
  if (calme) {
    return (
      <div className="ndc-placement">
        <span>{t('settings.calme.shownOn')}</span>
        {usage.length
          ? usage.map(entry => <span key={entry.page.id} className="ndc-tag ndc-tag--page">{t(entry.page.name)}</span>)
          : <span className="ndc-lib-unused">{t('settings.calme.notUsed')}</span>}
        <CalmeInfo text={t('settings.widgetPlacement.hint')} />
      </div>
    );
  }

  return (
    <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <LayoutGrid size={16} style={{ color: 'var(--nd-accent)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
          {usage.length
            ? t('settings.widgetPlacement.usedOn', { pages: usage.map(entry => t(entry.page.name)).join(', ') })
            : t('settings.widgetPlacement.unused')}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', lineHeight: 1.45 }}>
          {t('settings.widgetPlacement.hint')}
        </span>
      </div>
    </div>
  );
}
