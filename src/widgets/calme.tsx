'use client';

import React, { createContext, useContext, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';

/** Shared widget shell of the Calme interface: the title sits above a quiet block. */

/**
 * The title chosen for one widget on a page (`settings.customTitle`) and how
 * to change it; provided by the page around each widget.
 */
export const WidgetTitleContext = createContext<{ custom?: string; rename: (title: string) => void } | null>(null);

/**
 * A widget title: the custom one when set, otherwise the default. In edit
 * mode a click turns it into a field; Enter or leaving it saves, Escape
 * cancels, and an empty title brings the default back.
 */
export function WidgetTitleText({ title, editMode }: { title: string; editMode?: boolean }) {
  const { t } = useI18n();
  const context = useContext(WidgetTitleContext);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = context?.custom?.trim() || title;
  if (!editMode || !context) return <span>{shown}</span>;
  const commit = () => {
    if (draft === null) return;
    const value = draft.trim();
    context.rename(value === title ? '' : value);
    setDraft(null);
  };
  if (draft !== null) {
    return (
      <input
        className="ndc-title-input"
        autoFocus
        value={draft}
        maxLength={80}
        placeholder={title}
        aria-label={t('pages.widget.rename')}
        data-no-widget-drag
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); commit(); }
          if (event.key === 'Escape') { event.preventDefault(); setDraft(null); }
        }}
      />
    );
  }
  return (
    <button type="button" className="ndc-title-edit" title={t('pages.widget.renameHint')} onClick={() => setDraft(shown)}>
      {shown}
    </button>
  );
}

export function CalmeWidget({ title, aside, editMode, children, flush }: {
  title: string;
  aside?: React.ReactNode;
  editMode?: boolean;
  children: React.ReactNode;
  /** No inner padding (lists that draw their own rows). */
  flush?: boolean;
}) {
  const { config } = useConfig();
  const showTitle = !(config?.settings?.hideWidgetTitles ?? false) || editMode;
  return (
    <section className="ndc-widget">
      {showTitle && (
        <h3 className="ndc-title">
          <WidgetTitleText title={title} editMode={editMode} />
          {aside && <span className="ndc-title-aside">{aside}</span>}
        </h3>
      )}
      <div className={`ndc-box ${flush ? 'ndc-box--flush' : ''}`}>{children}</div>
    </section>
  );
}
