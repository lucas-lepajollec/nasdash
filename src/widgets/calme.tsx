'use client';

import React, { createContext, useContext, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetHeaderActions } from '@/components/widgets/WidgetHeaderActions';

/** Shared widget shell of the Calme interface: the title sits above a quiet block. */

/**
 * The title chosen for one widget on a page (`settings.customTitle`) and how
 * to change it; provided by the page around each widget. `visible` is this
 * widget's own choice to show or hide its title (`settings.showTitle`): it
 * wins over the general setting; undefined follows it.
 */
export const WidgetTitleContext = createContext<{
  custom?: string;
  rename: (title: string) => void;
  visible?: boolean;
  setVisible?: (visible: boolean) => void;
} | null>(null);

/**
 * Whether a widget's title shows outside edit mode: the widget's own choice
 * first, otherwise the general setting and the widget's default (`hiddenByDefault`).
 */
export function useTitleShown(hiddenByDefault = false): boolean {
  const { config } = useConfig();
  const context = useContext(WidgetTitleContext);
  return context?.visible ?? (!(config?.settings?.hideWidgetTitles ?? false) && !hiddenByDefault);
}

/**
 * Edit mode: the eye that shows or hides a title outside edit mode, for this
 * widget only. Next to a shown title; a hidden title stays hidden while
 * editing (the page does not jump) and its eye joins the widget's controls.
 */
export function WidgetTitleVisibility({ shown }: { shown: boolean }) {
  const { t } = useI18n();
  const context = useContext(WidgetTitleContext);
  if (!context?.setVisible) return null;
  const label = shown ? t('pages.widget.hideTitle') : t('pages.widget.showTitle');
  const button = (
    <button
      type="button"
      className={shown ? 'ndc-title-eye' : 'nd-action-icon'}
      aria-pressed={!shown}
      aria-label={label}
      title={label}
      data-no-widget-drag
      onClick={event => { event.stopPropagation(); context.setVisible?.(!shown); }}
    >
      {shown ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
    </button>
  );
  return shown ? button : <WidgetHeaderActions>{button}</WidgetHeaderActions>;
}

/**
 * A widget title: the custom one when set, otherwise the default. In edit
 * mode a click turns it into a field; Enter or leaving it saves, Escape
 * cancels, and an empty title brings the default back.
 */
export function WidgetTitleText({ title, editMode }: { title: string; editMode?: boolean }) {
  const { t } = useI18n();
  const context = useContext(WidgetTitleContext);
  const [draft, setDraft] = useState<string | null>(null);
  const pressAt = useRef<{ x: number; y: number } | null>(null);
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
  // Not a <button>: the title stays a place to grab the widget and drag it.
  // A press that moved was a drag, not a click to rename.
  const start = (event: React.PointerEvent) => { pressAt.current = { x: event.clientX, y: event.clientY }; };
  const open = (event: React.MouseEvent) => {
    const from = pressAt.current;
    if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > 4) return;
    setDraft(shown);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      className="ndc-title-edit"
      title={t('pages.widget.renameHint')}
      onPointerDown={start}
      onClick={open}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDraft(shown); } }}
    >
      {shown}
    </span>
  );
}

export function CalmeWidget({ title, aside, editMode, children, flush, hideTitle, bare }: {
  title: string;
  aside?: React.ReactNode;
  editMode?: boolean;
  children: React.ReactNode;
  /** No inner padding (lists that draw their own rows). */
  flush?: boolean;
  /** The title is hidden unless this widget is set to show it. */
  hideTitle?: boolean;
  /** The content without the surrounding block (header widgets). */
  bare?: boolean;
}) {
  const shown = useTitleShown(hideTitle);
  // Out of a page (nothing to save the choice in), edit mode shows the title to rename it.
  const pageTitle = useContext(WidgetTitleContext)?.setVisible !== undefined;
  const titled = shown || (editMode && !pageTitle);
  return (
    <section className={`ndc-widget ${bare ? 'ndc-widget--bare' : ''}`}>
      {titled && (
        <h3 className="ndc-title">
          <WidgetTitleText title={title} editMode={editMode} />
          {editMode && shown && <WidgetTitleVisibility shown />}
          {aside && <span className="ndc-title-aside">{aside}</span>}
        </h3>
      )}
      {editMode && !shown && <WidgetTitleVisibility shown={false} />}
      {bare ? children : <div className={`ndc-box ${flush ? 'ndc-box--flush' : ''}`}>{children}</div>}
    </section>
  );
}
