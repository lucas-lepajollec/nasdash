'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { TabDef, TabId } from '@/hooks/useTabs';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { usePages } from '@/providers/PagesProvider';
import { moveById, SortableItem, SortableList } from '../widgets/content/Sortable';
import { Emoji } from '../shared/Emoji';

/**
 * The pages in the header menu. In edit mode they are put in order by drag
 * and drop, renamed in place (pencil on hover, or a double click) and a new
 * page is created from the "+" at the end, without going through settings.
 * `tabs` is the whole ordered list; `start`/`end` the part shown here (the
 * menu can be split around the title).
 */
type TabsProps = {
  tabs: TabDef[]; start?: number; end?: number; activeTab?: TabId; onSwitch?: (id: TabId) => void; editing: boolean;
  showIcons: boolean; flushFirst: boolean; last: boolean; tabIcons?: Record<string, string>;
};

export function HeaderPageTabs(props: TabsProps) {
  // Out of edit mode the menu reads nothing more than its props: no page or settings subscription.
  return props.editing ? <EditableTabs {...props} /> : <PlainTabs {...props} />;
}

function PlainTabs({ tabs, start = 0, end = tabs.length, activeTab, onSwitch, showIcons, flushFirst, tabIcons }: TabsProps) {
  const { t } = useI18n();
  return (
    <nav data-tour="pages" className="nd-header-menu" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {tabs.slice(start, end).map((tab, index) => {
        const isActive = tab.id === activeTab;
        const icon = showIcons ? (tabIcons?.[tab.id] || tab.icon) : null;
        return (
          <button key={tab.id} type="button" aria-current={isActive ? 'page' : undefined} onClick={() => onSwitch?.(tab.id)}
            className={`nd-btn-menu-link nd-header-tab-link ${isActive ? 'is-active' : ''} ${index === 0 && flushFirst ? 'is-flush' : ''}`}>
            {icon && <span className="nd-header-tab-icon"><Emoji emoji={icon} /></span>}
            <span className="nd-header-tab-name">{t(tab.name)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function EditableTabs({ tabs, start = 0, end = tabs.length, activeTab, onSwitch, editing, showIcons, flushFirst, last }: TabsProps) {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const { pages, createPage, updatePageDetails } = usePages();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = tabs.slice(start, end);

  const move = (id: string, over: string) => {
    void updateConfig({ tabOrder: moveById(tabs, tab => tab.id, id, over).map(tab => tab.id) });
  };
  const rename = (id: string, value: string, current: string) => {
    setRenaming(null);
    const name = value.trim().slice(0, 100);
    if (name && name !== current) void updatePageDetails(id, { name });
  };
  const create = async () => {
    setBusy(true);
    try {
      const page = await createPage({ name: t('pages.settings.untitled'), icon: '📄', template: 'blank' });
      onSwitch?.(page.id);
      setRenaming(page.id);
    } finally { setBusy(false); }
  };

  return (
    <nav data-tour="pages" className={`nd-header-menu ${editing ? 'is-editing' : ''}`}>
      <Sortable editing={editing} ids={shown.map(tab => tab.id)} onMove={move}>
        {shown.map((tab, index) => {
          const isActive = tab.id === activeTab;
          const icon = showIcons ? (config?.settings?.tabIcons?.[tab.id] || tab.icon) : null;
          const label = t(tab.name);
          const canRename = editing && pages.some(page => page.id === tab.id);
          return (
            <Item key={tab.id} editing={editing} id={tab.id}>
              {renaming === tab.id
                ? <RenameField initial={label} onDone={value => rename(tab.id, value, label)} onCancel={() => setRenaming(null)} />
                : (
                  <>
                    <button type="button" aria-current={isActive ? 'page' : undefined} onClick={() => onSwitch?.(tab.id)}
                      onDoubleClick={canRename ? () => setRenaming(tab.id) : undefined}
                      className={`nd-btn-menu-link nd-header-tab-link ${isActive ? 'is-active' : ''} ${index === 0 && flushFirst ? 'is-flush' : ''}`}>
                      {icon && <span className="nd-header-tab-icon"><Emoji emoji={icon} /></span>}
                      <span className="nd-header-tab-name">{label}</span>
                    </button>
                    {canRename && (
                      <button type="button" className="nd-header-tab-rename" onClick={() => setRenaming(tab.id)}
                        aria-label={t('pages.settings.renameNamed', { name: label })} title={t('pages.settings.rename')}>
                        <Pencil size={11} />
                      </button>
                    )}
                  </>
                )}
            </Item>
          );
        })}
      </Sortable>
      {editing && last && (
        <button type="button" className="nd-header-tab-add" onClick={() => void create()} disabled={busy}
          aria-label={t('pages.header.newPage')} title={t('pages.header.newPage')}>
          {busy ? <span className="nd-spinner" aria-hidden="true" /> : <Plus size={14} />}
        </button>
      )}
    </nav>
  );
}

/** Drag and drop exists only while editing: out of edit mode the menu is plain buttons, with nothing listening. */
function Sortable({ editing, ids, onMove, children }: { editing: boolean; ids: string[]; onMove: (id: string, over: string) => void; children: React.ReactNode }) {
  return editing ? <SortableList ids={ids} enabled layout="row" onMove={onMove}>{children}</SortableList> : <>{children}</>;
}
function Item({ editing, id, children }: { editing: boolean; id: string; children: React.ReactNode }) {
  return editing ? <SortableItem id={id} className="nd-header-tab">{children}</SortableItem> : <div className="nd-header-tab">{children}</div>;
}

/** The page name, edited in place: Enter or leaving the field saves it, Escape keeps the old one. */
function RenameField({ initial, onDone, onCancel }: { initial: string; onDone: (value: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  return (
    <input ref={input} className="nd-header-tab-input" value={value} maxLength={100} aria-label={t('pages.settings.name')}
      size={Math.max(6, value.length + 1)}
      onChange={event => setValue(event.target.value)}
      // The drag handle must not swallow keys and clicks typed in the field.
      onPointerDown={event => event.stopPropagation()} onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Enter') input.current?.blur();
        if (event.key === 'Escape') { cancelled.current = true; onCancel(); }
      }}
      onBlur={() => { if (!cancelled.current) onDone(value); }} />
  );
}
