'use client';

import React, { useState } from 'react';
import { Copy, Loader2, Pencil, Plus, RotateCcw, Trash2, Type } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { PAGE_TEMPLATES, type PageTemplateId } from '@/lib/pages/presets';
import { isOfficialPageId, type Page } from '@/lib/pages/types';
import { usePages } from '@/providers/PagesProvider';
import ConfirmModal from '../../ConfirmModal';
import EmojiPickerModal from '../../EmojiPickerModal';
import { Emoji } from '../../../shared/Emoji';
import { useCalme } from '@/widgets/calme';
import { CalmeHeading } from '../shared/CalmeControls';

/** Miniature of a template, so the choice is visual rather than technical. */
function TemplatePreview({ template }: { template: PageTemplateId }) {
  const block = (flex: number | string, key: string, tall = false) => (
    <span key={key} style={{ flex, minWidth: 0, height: tall ? 38 : 16, borderRadius: 3, background: 'color-mix(in srgb, var(--nd-text) 14%, transparent)' }} />
  );
  const row = (children: React.ReactNode, key: string) => (
    <span key={key} style={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>{children}</span>
  );
  const shapes: Record<PageTemplateId, React.ReactNode[]> = {
    blank: [row([block(1, 'a', true)], 'r1')],
    dashboard: [row([block('0 0 14px', 'a', true), block(1, 'b'), block(1, 'c'), block('0 0 14px', 'd', true)], 'r1'), row([block(1, 'e')], 'r2')],
    docker: [row([block('0 0 22px', 'a', true), block(1, 'b', true)], 'r1')],
    networks: [row([block('0 0 22px', 'a', true), block(1, 'b', true)], 'r1')],
    widgets: [row([block(1, 'a'), block(1, 'b'), block(1, 'c'), block(1, 'd'), block(1, 'e')], 'r1'), row([block(1, 'f'), block(1, 'g'), block(1, 'h'), block(1, 'i'), block(1, 'j')], 'r2')],
  };
  return <span aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>{shapes[template]}</span>;
}

export function PagesSettingsTab({ onEditPage }: { onEditPage: (pageId: string) => void }) {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const { pages, createPage, duplicatePage, restorePage, deletePage, updatePageDetails, editing } = usePages();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📄');
  const [template, setTemplate] = useState<PageTemplateId>('blank');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [iconTarget, setIconTarget] = useState<'new' | string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Page | null>(null);
  const [pendingRestore, setPendingRestore] = useState<Page | null>(null);

  const order = config?.settings?.tabOrder ?? [];
  const sorted = [...pages].sort((a, b) => {
    const indexA = order.indexOf(a.id);
    const indexB = order.indexOf(b.id);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
  const calme = useCalme();
  const iconFor = (page: Page) => config?.settings?.tabIcons?.[page.id] ?? page.icon;

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : String(cause));
    } finally {
      setBusy(null);
    }
  };

  /** The page icon is the source of truth; a historical dock override is cleared. */
  const setPageIcon = (pageId: string, value: string) => run(`icon-${pageId}`, async () => {
    await updatePageDetails(pageId, { icon: value });
    const overrides = { ...(config?.settings?.tabIcons ?? {}) };
    if (pageId in overrides) {
      delete overrides[pageId];
      await updateConfig({ tabIcons: overrides });
    }
  });

  const create = () => run('create', async () => {
    const page = await createPage({ name: name.trim() || t('pages.settings.untitled'), icon, template });
    setName('');
    setIcon('📄');
    onEditPage(page.id);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <div role="alert" className="nd-page-settings-error">{error}</div>}
      {editing && <div className="nd-page-settings-note">{t('pages.settings.editingNote')}</div>}

      <section className="nd-settings-card nd-page-settings-card">
        {calme ? <CalmeHeading info={t('pages.settings.createDescription')}>{t('pages.settings.createTitle')}</CalmeHeading> : <>
          <h4>{t('pages.settings.createTitle')}</h4>
          <p>{t('pages.settings.createDescription')}</p>
        </>}
        <div className="nd-page-settings-create-row">
          <button type="button" className="nd-page-settings-icon" onClick={() => setIconTarget('new')} aria-label={t('pages.settings.chooseIcon')} title={t('pages.settings.chooseIcon')}>
            <Emoji emoji={icon} />
          </button>
          <input className="nd-input" value={name} maxLength={100} onChange={event => setName(event.target.value)} placeholder={t('pages.settings.namePlaceholder')} aria-label={t('pages.settings.name')} />
        </div>
        <div className="nd-page-settings-templates" role="radiogroup" aria-label={t('pages.settings.template')}>
          {PAGE_TEMPLATES.map(candidate => (
            <button key={candidate} type="button" role="radio" aria-checked={template === candidate} className={`nd-page-settings-template ${template === candidate ? 'is-active' : ''}`} onClick={() => setTemplate(candidate)}>
              <TemplatePreview template={candidate} />
              <strong>{t(`pages.template.${candidate}`)}</strong>
              <span>{t(`pages.template.${candidate}.description`)}</span>
            </button>
          ))}
        </div>
        <button type="button" className="nd-btn nd-btn-accent" onClick={() => void create()} disabled={busy === 'create'} style={{ alignSelf: 'flex-start', height: 34 }}>
          {busy === 'create' ? <Loader2 size={14} className="nd-spin" /> : <Plus size={14} />} {t('pages.settings.create')}
        </button>
      </section>

      <section className="nd-settings-card nd-page-settings-card">
        {calme ? <CalmeHeading info={t('pages.settings.listDescription')}>{t('pages.settings.listTitle')}</CalmeHeading> : <>
          <h4>{t('pages.settings.listTitle')}</h4>
          <p>{t('pages.settings.listDescription')}</p>
        </>}
        <ul className="nd-page-settings-list">
          {sorted.map(page => {
            const official = isOfficialPageId(page.id) || !!page.preset;
            const count = page.widgets.filter(widget => !widget.hidden).length;
            return (
              <li key={page.id} className="nd-page-settings-item">
                <button type="button" className="nd-page-settings-icon" onClick={() => setIconTarget(page.id)} aria-label={t('pages.settings.changeIcon', { name: t(page.name) })} title={t('pages.settings.chooseIcon')}>
                  <Emoji emoji={iconFor(page)} />
                </button>
                <div className="nd-page-settings-item-text">
                  {renaming?.id === page.id ? (
                    <form
                      onSubmit={event => {
                        event.preventDefault();
                        const value = renaming.value.trim();
                        setRenaming(null);
                        if (value && value !== t(page.name)) void run(`rename-${page.id}`, () => updatePageDetails(page.id, { name: value }));
                      }}
                    >
                      <input className="nd-input" autoFocus value={renaming.value} maxLength={100} aria-label={t('pages.settings.name')} onChange={event => setRenaming({ id: page.id, value: event.target.value })} onBlur={event => event.currentTarget.form?.requestSubmit()} onKeyDown={event => { if (event.key === 'Escape') setRenaming(null); }} />
                    </form>
                  ) : (
                    <strong>{t(page.name)}</strong>
                  )}
                  <span>
                    {t('pages.settings.widgetCount', { count })}
                    {official && <span className="nd-page-badge" style={{ marginLeft: 8 }}>{t('pages.settings.official')}</span>}
                  </span>
                </div>
                <div className="nd-page-toolbar-actions">
                  <button type="button" className="nd-page-icon-button" onClick={() => onEditPage(page.id)} title={t('pages.settings.edit')} aria-label={t('pages.settings.editNamed', { name: t(page.name) })}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="nd-page-icon-button" onClick={() => setRenaming({ id: page.id, value: t(page.name) })} title={t('pages.settings.rename')} aria-label={t('pages.settings.renameNamed', { name: t(page.name) })}>
                    <Type size={14} />
                  </button>
                  <button type="button" className="nd-page-icon-button" onClick={() => void run(`duplicate-${page.id}`, () => duplicatePage(page.id))} disabled={busy !== null} title={t('pages.settings.duplicate')} aria-label={t('pages.settings.duplicateNamed', { name: t(page.name) })}>
                    <Copy size={14} />
                  </button>
                  {official && (
                    <button type="button" className="nd-page-icon-button" onClick={() => setPendingRestore(page)} disabled={busy !== null} title={t('pages.settings.restore')} aria-label={t('pages.settings.restoreNamed', { name: t(page.name) })}>
                      <RotateCcw size={14} />
                    </button>
                  )}
                  <button type="button" className="nd-page-icon-button nd-page-icon-button--danger" onClick={() => setPendingDelete(page)} disabled={pages.length <= 1 || busy !== null} title={t('pages.settings.delete')} aria-label={t('pages.settings.deleteNamed', { name: t(page.name) })}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {iconTarget && (
        <EmojiPickerModal
          initialEmoji={iconTarget === 'new' ? icon : iconFor(pages.find(page => page.id === iconTarget)!)}
          title={t('pages.settings.chooseIcon')}
          onSelect={value => {
            if (iconTarget === 'new') setIcon(value);
            else void setPageIcon(iconTarget, value);
          }}
          onClose={() => setIconTarget(null)}
        />
      )}
      <ConfirmModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          const page = pendingDelete;
          setPendingDelete(null);
          if (page) void run(`delete-${page.id}`, () => deletePage(page.id));
        }}
        title={t('pages.settings.deleteTitle')}
        description={t('pages.settings.deleteDescription', { name: pendingDelete ? t(pendingDelete.name) : '' })}
        confirmLabel={t('pages.settings.delete')}
        cancelLabel={t('Annuler')}
      />
      <ConfirmModal
        isOpen={!!pendingRestore}
        onClose={() => setPendingRestore(null)}
        onConfirm={() => {
          const page = pendingRestore;
          setPendingRestore(null);
          if (page) void run(`restore-${page.id}`, () => restorePage(page.id));
        }}
        title={t('pages.settings.restoreTitle')}
        description={t('pages.settings.restoreDescription', { name: pendingRestore ? t(pendingRestore.name) : '' })}
        confirmLabel={t('pages.settings.restore')}
        cancelLabel={t('Annuler')}
      />
    </div>
  );
}
