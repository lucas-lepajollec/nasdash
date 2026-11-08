'use client';

import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { WidgetSettingsButton } from '@/components/widgets/content/kit';
import { CalmeWidget } from '../calme';

export type TodoItem = { id: string; text: string; done: boolean };
export const TODO_MAX = 100;
export const TODO_TEXT_MAX = 200;

const newTaskId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The saved list, cleaned: unknown entries are dropped, texts are bounded. */
export function todoItems(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const { id, text, done } = item as Record<string, unknown>;
    return typeof id === 'string' && typeof text === 'string' && text.trim() ? [{ id: id.slice(0, 40), text: text.slice(0, TODO_TEXT_MAX), done: done === true }] : [];
  }).slice(0, TODO_MAX);
}

/**
 * A short list of things to do, kept with the widget. An administrator ticks,
 * adds and removes tasks in place; everyone else reads the list.
 */
export default function CalmeTodo({ settings, editMode, onUpdateSettings }: { settings: WidgetSettings; editMode: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const { user } = useConfig();
  const admin = user?.role === 'admin';
  const items = todoItems(settings.items);
  const hideDone = settings.hideDone === true;
  const shown = hideDone ? items.filter(item => !item.done) : items;
  const [text, setText] = useState('');
  const title = t('widget.todo.name');
  const save = (next: TodoItem[]) => onUpdateSettings({ items: next });
  const add = () => {
    const value = text.trim().slice(0, TODO_TEXT_MAX);
    if (!value || items.length >= TODO_MAX) return;
    save([...items, { id: newTaskId(), text: value, done: false }]);
    setText('');
  };
  const left = items.filter(item => !item.done).length;

  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings}>
          {(draft, change) => (
            <>
              <CalmeRow label={t('widgets.todo.hideDone')}>
                <CalmeSwitch label={t('widgets.todo.hideDone')} checked={draft.hideDone === true} onChange={on => change({ hideDone: on || null })} />
              </CalmeRow>
              <CalmeRow label={t('widgets.todo.clearDone')}>
                <button type="button" className="nd-btn nd-btn-compact" disabled={!todoItems(draft.items).some(item => item.done)} onClick={() => change({ items: todoItems(draft.items).filter(item => !item.done) })}>{t('widgets.todo.clearDoneAction')}</button>
              </CalmeRow>
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div className="ndw-todo">
        {items.length > 0 && <span className="ndw-media-sub">{left ? t('widgets.todo.left', { count: left }) : t('widgets.todo.allDone')}</span>}
        {shown.length > 0 && (
          <ul className="ndw-todo-list">
            {shown.map(item => (
              <li key={item.id} className={item.done ? 'is-done' : ''}>
                <button type="button" className="ndw-todo-check" role="checkbox" aria-checked={item.done} disabled={!admin} data-no-widget-drag
                  aria-label={item.text} onClick={() => save(items.map(entry => entry.id === item.id ? { ...entry, done: !entry.done } : entry))}>
                  {item.done && <Check size={11} aria-hidden="true" />}
                </button>
                <span className="ndw-todo-text">{item.text}</span>
                {admin && (
                  <button type="button" className="ndw-todo-remove" data-no-widget-drag aria-label={t('widgets.todo.remove', { text: item.text })} title={t('widgets.todo.remove', { text: item.text })}
                    onClick={() => save(items.filter(entry => entry.id !== item.id))}>
                    <X size={11} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {items.length === 0 && !admin && <span className="ndw-media-sub is-quiet">{t('widgets.todo.emptyViewer')}</span>}
        {admin && items.length < TODO_MAX && (
          <form className="ndw-todo-add" onSubmit={event => { event.preventDefault(); add(); }} data-no-widget-drag>
            <Plus size={12} aria-hidden="true" />
            <input value={text} maxLength={TODO_TEXT_MAX} placeholder={t('widgets.todo.add')} aria-label={t('widgets.todo.add')} onChange={event => setText(event.target.value)} />
          </form>
        )}
      </div>
    </CalmeWidget>
  );
}
