'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight, Folder, Search } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { BookmarkItem } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import CustomSelect from '@/components/shared/CustomSelect';
import { Emoji } from '@/components/shared/Emoji';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { CalmeWidget } from '../calme';
import { pick, SiteIcon, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { childrenOf, descendantsOf, folderOptions, hostOf, pathTo } from './tree';
import { BookmarkDragScope, useBookmarkDrag, useBookmarkZone } from './dnd';

export type BookmarksDisplay = 'tree' | 'tiles' | 'icons';
const DISPLAYS: readonly BookmarksDisplay[] = ['tree', 'tiles', 'icons'];

/**
 * Links from the bookmarks library (Settings → Widgets → Bookmarks), opened at
 * the folder this widget chooses. Three displays: a tree whose folders fold
 * open, tiles that step into folders with a path back, and icons only. A
 * search box finds a link anywhere below the widget's folder.
 */
export default function CalmeBookmarks({ widgetId, settings, editMode, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const items = useMemo<BookmarkItem[]>(() => config?.settings?.bookmarks ?? [], [config?.settings?.bookmarks]);
  const display = pick(settings.display, DISPLAYS, 'tree');
  const root = typeof settings.rootId === 'string' && items.some(item => item.id === settings.rootId && item.kind === 'folder') ? settings.rootId : undefined;
  const [query, setQuery] = useState('');
  const title = (root && items.find(item => item.id === root)?.title) || t('widget.bookmarks.name');
  const widget = { id: widgetId, type: 'bookmarks' as const };
  const options = { widget, newTab: settings.newTab !== false, descriptions: settings.descriptions === true };

  const found = useMemo(() => {
    const words = query.trim().toLowerCase();
    if (!words) return null;
    const inside = root ? descendantsOf(items, root) : null;
    return items.filter(item => item.kind === 'link' && (!inside || inside.has(item.id)) && `${item.title} ${item.url} ${item.description ?? ''}`.toLowerCase().includes(words));
  }, [items, query, root]);

  const links = items.filter(item => item.kind === 'link').length;
  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: t('widget.bookmarks.name') })} settings={settings} onSave={onUpdateSettings} shared={{ tab: 'widget-bookmarks', label: t('widgets.bookmarks.manage') }}>
          {(draft, change) => <BookmarksSettings draft={draft} change={change} items={items} />}
        </WidgetSettingsButton>
      )}
      {links === 0 ? (
        <SetupGuide kind="bookmarks" />
      ) : (
        <div className="ndw-bookmarks">
          {settings.search === true && (
            <label className="ndw-bookmark-search">
              <Search size={13} aria-hidden="true" />
              <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('widgets.bookmarks.search')} aria-label={t('widgets.bookmarks.search')} />
            </label>
          )}
          {found
            ? (found.length ? <ul className="ndw-bookmark-list">{found.map(item => <li key={item.id}><BookmarkLink item={item} {...options} path={pathTo(items, item.parentId).map(folder => folder.title).join(' / ')} /></li>)}</ul>
              : <div className="ndc-empty">{t('widgets.bookmarks.noMatch')}</div>)
            : (
              // In edit mode, links and folders move by drag and drop (saved for every bookmarks widget).
              <BookmarkDragScope items={items} enabled={editMode} onChange={next => void updateConfig({ bookmarks: next })} overlay={item => <span className="ndw-bookmark"><BookmarkIcon item={item} widget={widget} size={18} /><span className="ndw-bookmark-title">{item.title}</span></span>}>
                {display === 'tree' ? <Tree items={items} parentId={root} depth={0} options={options} />
                  : <Browser items={items} root={root} icons={display === 'icons'} options={options} />}
              </BookmarkDragScope>
            )}
        </div>
      )}
    </CalmeWidget>
  );
}

type LinkOptions = { widget: { id: string; type: 'bookmarks' }; newTab: boolean; descriptions: boolean };

/** A bookmark's own icon (emoji or symbol), else a folder or its site's icon. */
export function BookmarkIcon({ item, widget, size }: { item: BookmarkItem; widget?: LinkOptions['widget']; size: number }) {
  if (item.icon) return <span className="ndw-bookmark-emoji" style={{ width: size, height: size, fontSize: size * 0.85, ...(item.color ? { color: item.color } : {}) }} aria-hidden="true"><Emoji emoji={item.icon} /></span>;
  if (item.kind === 'folder') return <Folder size={size - 2} className="ndw-bookmark-folder-icon" style={item.color ? { color: item.color } : undefined} aria-hidden="true" />;
  return <SiteIcon url={item.url} name={item.title} widget={widget} size={size} />;
}

function BookmarkLink({ item, widget, newTab, descriptions, path, compact }: LinkOptions & { item: BookmarkItem; path?: string; compact?: boolean }) {
  const detail = descriptions && item.description ? item.description : path;
  const { attach, handle, dropClass, enabled: dragging } = useBookmarkDrag(item, compact ? 'horizontal' : 'vertical');
  return (
    <a ref={attach} {...handle} onClick={dragging ? event => event.preventDefault() : undefined} className={`ndw-bookmark ${compact ? 'is-icon' : ''} ${dropClass}`} href={item.url} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : { rel: 'noreferrer' })} title={[item.title, item.description, hostOf(item.url)].filter(Boolean).join('\n')}>
      <BookmarkIcon item={item} widget={widget} size={compact ? 26 : 18} />
      {!compact && (
        <span className="ndw-bookmark-text">
          <span className="ndw-bookmark-title">{item.title}</span>
          {detail && <span className="ndw-bookmark-detail">{detail}</span>}
        </span>
      )}
      {compact && <span className="ndw-bookmark-label">{item.title}</span>}
    </a>
  );
}

/** Folders fold open in place; the open ones are remembered by this browser. */
function Tree({ items, parentId, depth, options }: { items: BookmarkItem[]; parentId?: string; depth: number; options: LinkOptions }) {
  const { t } = useI18n();
  const [open, setOpen] = useOpenFolders(options.widget.id);
  return (
    <ul className="ndw-bookmark-list" role={depth === 0 ? 'tree' : 'group'} aria-label={depth === 0 ? t('widget.bookmarks.name') : undefined}>
      {childrenOf(items, parentId).map(item => item.kind === 'folder' ? (
        <li key={item.id} role="treeitem" aria-expanded={open.has(item.id)} aria-selected={false}>
          <FolderRow item={item} count={childrenOf(items, item.id).length} open={open.has(item.id)} onToggle={() => setOpen(item.id)} widget={options.widget} />
          {open.has(item.id) && <div className="ndw-bookmark-nested"><Tree items={items} parentId={item.id} depth={depth + 1} options={options} /></div>}
        </li>
      ) : <li key={item.id} role="treeitem" aria-selected={false}><BookmarkLink item={item} {...options} /></li>)}
    </ul>
  );
}

function FolderRow({ item, count, open, onToggle, widget }: { item: BookmarkItem; count: number; open: boolean; onToggle: () => void; widget: LinkOptions['widget'] }) {
  const { attach, handle, dropClass, enabled: dragging } = useBookmarkDrag(item);
  return (
    <button ref={attach} {...handle} type="button" className={`ndw-bookmark is-folder ${dropClass}`} onClick={onToggle}>
      <ChevronRight size={13} className={`ndw-bookmark-chevron ${open ? 'is-open' : ''}`} aria-hidden="true" />
      <BookmarkIcon item={item} widget={widget} size={18} />
      <span className="ndw-bookmark-title">{item.title}</span>
      <span className="ndw-bookmark-count">{count}</span>
    </button>
  );
}

/** A folder tile of the tiles and icons displays: a click steps in. */
function FolderTile({ item, count, icons, onOpen, widget }: { item: BookmarkItem; count: number; icons: boolean; onOpen: () => void; widget: LinkOptions['widget'] }) {
  const { t } = useI18n();
  const { attach, handle, dropClass, enabled: dragging } = useBookmarkDrag(item, 'horizontal');
  return (
    <button ref={attach} {...handle} type="button" className={`ndw-bookmark is-folder ${icons ? 'is-icon' : ''} ${dropClass}`} onClick={onOpen} title={item.title}>
      <BookmarkIcon item={item} widget={widget} size={icons ? 28 : 20} />
      {icons ? <span className="ndw-bookmark-label">{item.title}</span> : <span className="ndw-bookmark-text"><span className="ndw-bookmark-title">{item.title}</span><span className="ndw-bookmark-detail">{t('widgets.bookmarks.itemCount', { count })}</span></span>}
    </button>
  );
}

/** A path segment: steps back to that folder, and takes dropped bookmarks into it. */
function PathStep({ folderId, label, current, onOpen }: { folderId: string | undefined; label: string; current?: boolean; onOpen: () => void }) {
  const { attach, over } = useBookmarkZone(folderId, `path-${folderId ?? 'root'}`);
  if (current) return <span ref={attach} className={over ? 'is-drop-inside' : undefined} aria-current="location">{label}</span>;
  return <button ref={attach} type="button" className={over ? 'is-drop-inside' : undefined} onClick={onOpen}>{label}</button>;
}

function useOpenFolders(widgetId: string): [Set<string>, (id: string) => void] {
  const key = `ndw-bookmarks-open:${widgetId}`;
  const [open, setOpen] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]); } catch { return new Set(); }
  });
  const toggle = (id: string) => setOpen(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* Private browsing. */ }
    return next;
  });
  return [open, toggle];
}

/** Tiles or icons of one folder at a time, with the path back to the widget's folder. */
function Browser({ items, root, icons, options }: { items: BookmarkItem[]; root?: string; icons: boolean; options: LinkOptions }) {
  const { t } = useI18n();
  const [here, setHere] = useState<string | undefined>(root);
  const current = here && (here === root || (root ? descendantsOf(items, root).has(here) : true)) && items.some(item => item.id === here) ? here : root;
  const rootDepth = pathTo(items, root).length;
  const path = pathTo(items, current).slice(rootDepth);
  return (
    <>
      {path.length > 0 && (
        <nav className="ndw-bookmark-path" aria-label={t('widgets.bookmarks.path')}>
          <PathStep folderId={root} label={(root ? items.find(item => item.id === root)?.title : undefined) ?? t('widget.bookmarks.name')} onOpen={() => setHere(root)} />
          {path.map((folder, index) => (
            <React.Fragment key={folder.id}>
              <ChevronRight size={11} aria-hidden="true" />
              <PathStep folderId={folder.id} label={folder.title} current={index === path.length - 1} onOpen={() => setHere(folder.id)} />
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className={icons ? 'ndw-bookmark-icons' : 'ndw-bookmark-tiles'}>
        {childrenOf(items, current).map(item => item.kind === 'folder' ? (
          <FolderTile key={item.id} item={item} count={childrenOf(items, item.id).length} icons={icons} onOpen={() => setHere(item.id)} widget={options.widget} />
        ) : <BookmarkLink key={item.id} item={item} {...options} compact={icons} />)}
      </div>
    </>
  );
}

function BookmarksSettings({ draft, change, items }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void; items: BookmarkItem[] }) {
  const { t } = useI18n();
  const folders = folderOptions(items);
  return (
    <>
      <CalmeField label={t('widgets.bookmarks.folder')}>
        <CustomSelect
          ariaLabel={t('widgets.bookmarks.folder')}
          value={typeof draft.rootId === 'string' && folders.some(({ folder }) => folder.id === draft.rootId) ? draft.rootId : ''}
          onChange={id => change({ rootId: id || null })}
          options={[{ value: '', label: t('widgets.bookmarks.allLibrary') }, ...folders.map(({ folder, depth }) => ({ value: folder.id, label: `${'— '.repeat(depth)}${folder.title}` }))]}
        />
      </CalmeField>
      <CalmeField label={t('widgets.display')}>
        <CalmeSegmented label={t('widgets.display')} value={pick(draft.display, DISPLAYS, 'tree')} options={DISPLAYS.map(value => ({ value, label: t(`widgets.bookmarks.display.${value}`) }))} onChange={value => change({ display: value })} />
      </CalmeField>
      <CalmeRow label={t('widgets.bookmarks.searchBox')}>
        <CalmeSwitch label={t('widgets.bookmarks.searchBox')} checked={draft.search === true} onChange={on => change({ search: on || null })} />
      </CalmeRow>
      <CalmeRow label={t('widgets.bookmarks.descriptions')}>
        <CalmeSwitch label={t('widgets.bookmarks.descriptions')} checked={draft.descriptions === true} onChange={on => change({ descriptions: on || null })} />
      </CalmeRow>
      <CalmeRow label={t('widgets.bookmarks.newTab')}>
        <CalmeSwitch label={t('widgets.bookmarks.newTab')} checked={draft.newTab !== false} onChange={on => change({ newTab: on ? null : false })} />
      </CalmeRow>
    </>
  );
}
