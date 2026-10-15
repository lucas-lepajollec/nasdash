'use client';

import React from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Saved sources of a content widget (feeds, symbols, quotes) in its settings
 * tab: one row each with its name and detail, moved up/down or removed.
 * Changes are passed back whole; the tab saves them.
 */
export function SourceList<T extends { id: string }>({ items, onChange, name, detail, empty, label }: {
  items: T[];
  onChange: (items: T[]) => void;
  name: (item: T) => React.ReactNode;
  detail?: (item: T) => React.ReactNode;
  /** Shown while the list is empty. */
  empty: string;
  /** Accessible list name. */
  label: string;
}) {
  const { t } = useI18n();
  const move = (from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  if (!items.length) return <p className="ndc-source-empty">{empty}</p>;
  return (
    <ul className="ndc-set-list ndc-source-list" aria-label={label}>
      {items.map((item, index) => {
        const title = typeof name(item) === 'string' ? name(item) as string : '';
        return (
          <li key={item.id} className="ndc-set-list-row ndc-source-row">
            <span className="ndc-source-text">
              <span className="ndc-source-name">{name(item)}</span>
              {detail && <span className="ndc-set-list-sub ndc-source-detail">{detail(item)}</span>}
            </span>
            <span className="ndc-source-tools">
              <button type="button" className="ndc-icon-button" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={t('widgets.list.moveUp', { name: title })} title={t('widgets.list.moveUp', { name: title })}><ArrowUp size={13} /></button>
              <button type="button" className="ndc-icon-button" disabled={index === items.length - 1} onClick={() => move(index, index + 1)} aria-label={t('widgets.list.moveDown', { name: title })} title={t('widgets.list.moveDown', { name: title })}><ArrowDown size={13} /></button>
              <button type="button" className="ndc-icon-button is-danger" onClick={() => onChange(items.filter(other => other.id !== item.id))} aria-label={t('widgets.list.remove', { name: title })} title={t('widgets.list.remove', { name: title })}><X size={13} /></button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** A short random id for a new source (kept when it is renamed or moved). */
export function sourceId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
