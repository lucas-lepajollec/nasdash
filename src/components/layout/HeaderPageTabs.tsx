'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Folder, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { TabDef, TabId } from '@/hooks/useTabs';
import { itemPages, menuItems, type MenuGroup, type MenuItem } from '@/lib/pages/menu';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { usePages } from '@/providers/PagesProvider';
import { moveById, SortableItem, SortableList } from '../widgets/content/Sortable';
import { Emoji } from '../shared/Emoji';
import { WidgetHeaderActions } from '../widgets/WidgetHeaderActions';
import ConfirmModal from '../modals/ConfirmModal';

/**
 * The pages in the header menu. In edit mode they are put in order by drag
 * and drop, renamed in place (pencil on hover, or a double click), deleted
 * (bin on hover, after a confirmation) and a new page is created from the
 * "+" among the widget's controls, without going through settings.
 * `tabs` is the whole ordered list; `start`/`end` the part shown here (the
 * menu can be split around another widget). Sub-menus (`groups`) show their
 * name where their first page is and unfold their pages. With a `limit`, the
 * pages and sub-menus after it unfold from a last "Others" button; in edit
 * mode the unfolded pages are reordered, renamed and deleted there too.
 */
type TabsProps = {
  tabs: TabDef[]; start?: number; end?: number; activeTab?: TabId; onSwitch?: (id: TabId) => void; editing: boolean;
  showIcons: boolean; flushFirst: boolean; last: boolean; tabIcons?: Record<string, string>;
  /** How many pages (or sub-menus) show in the row; the others unfold from the last button. */
  limit?: number;
  groups?: MenuGroup[];
};

type Entry = MenuItem<TabDef>;

/** What this menu shows: the entries in the row, then those under "Others". */
function splitItems({ tabs, start = 0, end = tabs.length, limit, groups = [] }: TabsProps): [Entry[], Entry[]] {
  const items = menuItems(tabs.slice(start, end), groups);
  const cut = limit && limit > 0 && limit < items.length ? limit : items.length;
  return [items.slice(0, cut), items.slice(cut)];
}

const OTHERS = 'others';

export function HeaderPageTabs(props: TabsProps) {
  // Out of edit mode the menu reads nothing more than its props: no page or settings subscription.
  return props.editing ? <EditableTabs {...props} /> : <PlainTabs {...props} />;
}

/**
 * The entries of a menu, drawn by `page` for each page. One unfolded list at
 * a time (`open`): a sub-menu or "Others", whose sub-menus show as headings.
 */
function Entries({ row, more, activeTab, open, setOpen, page }: {
  row: Entry[]; more: Entry[]; activeTab?: TabId; open: string | null; setOpen: (id: string | null) => void;
  page: (tab: TabDef, inPanel: boolean) => React.ReactNode;
}) {
  const { t } = useI18n();
  const toggle = (id: string) => (next: boolean) => setOpen(next ? id : open === id ? null : open);
  return (
    <>
      {row.map(entry => entry.kind === 'page' ? page(entry.tab, false) : (
        <Dropdown key={entry.id} label={t(entry.group.name)} count={entry.tabs.length} open={open === entry.id} onOpenChange={toggle(entry.id)}>
          {entry.tabs.map(tab => page(tab, true))}
        </Dropdown>
      ))}
      {more.length > 0 && (
        <Dropdown label={t('pages.header.more')} count={more.flatMap(itemPages).length} others open={open === OTHERS} onOpenChange={toggle(OTHERS)}>
          {more.map(entry => entry.kind === 'page' ? page(entry.tab, true) : (
            <React.Fragment key={entry.id}>
              <p className="nd-header-more-heading">{t(entry.group.name)}</p>
              {entry.tabs.map(tab => page(tab, true))}
            </React.Fragment>
          ))}
        </Dropdown>
      )}
    </>
  );
}

function PlainTabs(props: TabsProps) {
  const { activeTab, onSwitch, showIcons, flushFirst, tabIcons } = props;
  const { t } = useI18n();
  const [row, more] = splitItems(props);
  const [open, setOpen] = useState<string | null>(null);
  const page = (tab: TabDef, inPanel: boolean) => {
    const isActive = tab.id === activeTab;
    const icon = showIcons ? (tabIcons?.[tab.id] || tab.icon) : null;
    return (
      <button key={tab.id} type="button" aria-current={isActive ? 'page' : undefined}
        onClick={() => { if (inPanel) setOpen(null); onSwitch?.(tab.id); }}
        className={`nd-btn-menu-link nd-header-tab-link ${isActive ? 'is-active' : ''} ${!inPanel && row[0]?.id === tab.id && flushFirst ? 'is-flush' : ''}`}>
        {icon && <span className="nd-header-tab-icon"><Emoji emoji={icon} /></span>}
        <span className="nd-header-tab-name">{t(tab.name)}</span>
      </button>
    );
  };
  return (
    <nav data-tour="pages" className="nd-header-menu">
      <Entries row={row} more={more} activeTab={activeTab} open={open} setOpen={setOpen} page={page} />
    </nav>
  );
}

function EditableTabs(props: TabsProps) {
  const { tabs, activeTab, onSwitch, editing, showIcons, flushFirst, last } = props;
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const { pages, createPage, updatePageDetails, deletePage } = usePages();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TabDef | null>(null);
  const [busy, setBusy] = useState(false);
  const [row, more] = splitItems(props);
  const [chosen, setChosen] = useState<string | null>(null);
  // A page being named (just added) unfolds the list that holds it.
  const holder = renaming === null ? null
    : row.find(entry => entry.kind === 'group' && entry.tabs.some(tab => tab.id === renaming))?.id
      ?? (more.some(entry => itemPages(entry).some(tab => tab.id === renaming)) ? OTHERS : null);
  const open = holder ?? chosen;

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

  const page = (tab: TabDef, inPanel: boolean) => {
    const isActive = tab.id === activeTab;
    const icon = showIcons ? (config?.settings?.tabIcons?.[tab.id] || tab.icon) : null;
    const label = t(tab.name);
    const canRename = editing && pages.some(candidate => candidate.id === tab.id);
    // The last page stays: a dashboard always has one.
    const canDelete = canRename && pages.length > 1;
    return (
      <Item key={tab.id} editing={editing} id={tab.id}>
        {renaming === tab.id
          ? <RenameField initial={label} onDone={value => rename(tab.id, value, label)} onCancel={() => setRenaming(null)} />
          : (
            <>
              <button type="button" aria-current={isActive ? 'page' : undefined} onClick={() => onSwitch?.(tab.id)}
                onDoubleClick={canRename ? () => setRenaming(tab.id) : undefined}
                className={`nd-btn-menu-link nd-header-tab-link ${isActive ? 'is-active' : ''} ${!inPanel && row[0]?.id === tab.id && flushFirst ? 'is-flush' : ''}`}>
                {icon && <span className="nd-header-tab-icon"><Emoji emoji={icon} /></span>}
                <span className="nd-header-tab-name">{label}</span>
              </button>
              {canDelete && (
                <button type="button" className="nd-header-tab-delete" onClick={() => setPendingDelete(tab)}
                  aria-label={t('pages.settings.deleteNamed', { name: label })} title={t('pages.settings.delete')}>
                  <Trash2 size={11} />
                </button>
              )}
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
  };

  return (
    <nav data-tour="pages" className={`nd-header-menu ${editing ? 'is-editing' : ''}`}>
      {/* One list for the row and every unfolded list: a page moves between them by drag and drop. */}
      <Sortable editing={editing} ids={[...row, ...more].flatMap(itemPages).map(tab => tab.id)} onMove={move}>
        <Entries row={row} more={more} activeTab={activeTab} open={open} setOpen={setChosen} page={page} />
      </Sortable>
      {editing && last && (
        <WidgetHeaderActions>
          <button type="button" className="nd-action-icon success" onClick={() => void create()} disabled={busy}
            aria-label={t('pages.header.newPage')} title={t('pages.header.newPage')}>
            {busy ? <span className="nd-spinner" aria-hidden="true" /> : <Plus size={13} />}
          </button>
        </WidgetHeaderActions>
      )}
      <ConfirmModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => { if (pendingDelete) await deletePage(pendingDelete.id); }}
        title={t('pages.settings.deleteTitle')}
        description={t('pages.settings.deleteDescription', { name: pendingDelete ? t(pendingDelete.name) : '' })}
        confirmLabel={t('pages.settings.delete')}
        cancelLabel={t('Annuler')}
      />
    </nav>
  );
}

/** Drag and drop exists only while editing: out of edit mode the menu is plain buttons, with nothing listening. */
function Sortable({ editing, ids, onMove, children }: { editing: boolean; ids: string[]; onMove: (id: string, over: string) => void; children: React.ReactNode }) {
  return editing ? <SortableList ids={ids} enabled layout="grid" onMove={onMove}>{children}</SortableList> : <>{children}</>;
}

/**
 * A menu entry that unfolds a list below itself: a sub-menu (named after it)
 * or the last "Others" button. Neither is highlighted: the page shown is, in the list.
 */
function Dropdown({ label, count, others = false, open, onOpenChange, children }: {
  label: string; count: number; others?: boolean; open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode;
}) {
  const { t } = useI18n();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  // Under the button, kept inside the window.
  const place = (node: HTMLDivElement | null) => {
    const box = trigger.current?.getBoundingClientRect();
    if (!node || !box) return;
    node.style.top = `${Math.round(box.bottom + 6)}px`;
    const left = Math.min(box.left, window.innerWidth - node.offsetWidth - 8);
    node.style.left = `${Math.max(8, Math.round(left))}px`;
  };
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (trigger.current?.contains(target) || panel.current?.contains(target)) return;
      onOpenChange(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onOpenChange(false);
      trigger.current?.focus();
    };
    const follow = () => place(panel.current);
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
  }, [onOpenChange, open]);

  return (
    <>
      <button ref={trigger} type="button" aria-expanded={open}
        title={others ? t('pages.header.morePages', { count }) : undefined}
        onClick={() => onOpenChange(!open)}
        className="nd-btn-menu-link nd-header-tab-link nd-header-tab-more">
        {/* Drawn only in the icon style, where every page has one. */}
        <span className="nd-header-tab-icon nd-header-tab-more-icon" aria-hidden="true">{others ? <MoreHorizontal size={16} /> : <Folder size={16} />}</span>
        <span className="nd-header-tab-name">{label}</span>
        <ChevronDown size={13} aria-hidden="true" className="nd-header-tab-more-chevron" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={node => { panel.current = node; place(node); }} className="nd-header-more-panel" role="group" aria-label={label}>
          {children}
        </div>,
        document.body,
      )}
    </>
  );
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
