import React from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { WIDGET_CATALOG, WIDGET_GROUP_ORDER } from '@/lib/widgets/catalog';
import { usePages } from '@/providers/PagesProvider';
import { Emoji } from '../../../shared/Emoji';
import { ChevronRight } from 'lucide-react';
import { CalmeHeading, CalmeInfo } from '../shared/CalmeControls';

interface LibraryTabProps {
  setActiveTab: (tabId: string) => void;
}

/**
 * Overview of every widget type and where it is used. Widgets are added,
 * hidden and removed directly on pages in edit mode; this screen explains the
 * catalogue and links to the shared options of each type.
 */
export function LibraryTab({ setActiveTab }: LibraryTabProps) {
  const { t } = useI18n();
  const { pages } = usePages();

  const usage = (type: string) => pages.filter(page => page.widgets.some(widget => widget.type === type && !widget.hidden));

  // Calme: one quiet row per widget (icon, name, pages where it is placed);
  // the row opens its options when it has some.
  return (
    <div className="ndc-set-page">
      {WIDGET_GROUP_ORDER.map(group => {
        const entries = WIDGET_CATALOG.filter(entry => entry.group === group && !entry.internal);
        if (!entries.length) return null;
        return (
          <section key={group} className="ndc-set-block">
            <CalmeHeading>{t(`pages.library.group.${group}`)}</CalmeHeading>
            {entries.map(entry => {
              const pagesUsing = usage(entry.type);
              const content = (
                <>
                  <span className="ndc-lib-icon"><Emoji emoji={entry.icon} /></span>
                  <span className="ndc-lib-name">{t(entry.nameKey)}<CalmeInfo text={t(entry.descriptionKey)} /></span>
                  <span className="ndc-lib-pages">
                    {pagesUsing.length
                      ? pagesUsing.map(page => <span key={page.id} className="ndc-tag ndc-tag--page">{t(page.name)}</span>)
                      : <span className="ndc-lib-unused">{t('settings.calme.notUsed')}</span>}
                  </span>
                  {entry.settingsTab ? <ChevronRight size={15} className="ndc-lib-chevron" aria-hidden="true" /> : <span className="ndc-lib-chevron" />}
                </>
              );
              return entry.settingsTab
                ? <button key={entry.type} type="button" className="ndc-lib-row" onClick={() => setActiveTab(entry.settingsTab!)}>{content}</button>
                : <div key={entry.type} className="ndc-lib-row">{content}</div>;
            })}
          </section>
        );
      })}
    </div>
  );
}
