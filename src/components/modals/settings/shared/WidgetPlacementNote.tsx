import React from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { usePages } from '@/providers/PagesProvider';
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

  // Calme: one quiet line, the pages as small tags, the hint below.
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
