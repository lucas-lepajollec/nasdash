import React from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { WIDGET_CATALOG, WIDGET_GROUP_ORDER } from '@/lib/widgets/catalog';
import { usePages } from '@/providers/PagesProvider';
import { Emoji } from '../../../shared/Emoji';
import { ChevronRight } from 'lucide-react';
import { useCalme } from '@/widgets/calme';
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
  const calme = useCalme();

  // Calme: one quiet row per widget (icon, name, pages where it is placed);
  // the row opens its options when it has some.
  if (calme) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--nd-text-muted)', lineHeight: 1.5 }}>
        {t('settings.library.description')}
      </p>

      {WIDGET_GROUP_ORDER.map(group => {
        const entries = WIDGET_CATALOG.filter(entry => entry.group === group && !entry.internal);
        if (!entries.length) return null;
        return (
          <section key={group}>
            <h5 style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>
              {t(`pages.library.group.${group}`)}
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {entries.map(entry => {
                const pagesUsing = usage(entry.type);
                return (
                  <div key={entry.type} style={{ padding: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Emoji emoji={entry.icon} /> {t(entry.nameKey)}
                    </span>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>{t(entry.descriptionKey)}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
                      <span style={{ fontSize: '0.64rem', color: pagesUsing.length ? 'var(--nd-green)' : 'var(--nd-text-dimmed)', fontWeight: 600 }}>
                        {pagesUsing.length
                          ? t('settings.library.usedOn', { pages: pagesUsing.map(page => t(page.name)).join(', ') })
                          : t('settings.library.unused')}
                      </span>
                      {entry.settingsTab && (
                        <button type="button" onClick={() => setActiveTab(entry.settingsTab!)} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                          {t('Configurer →')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
