import React, { useState } from 'react';
import { FolderPlus, GripVertical, Pencil, Plus, Upload, X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import type { BookmarkItem } from '@/lib/widgetData/contracts';
import CustomSelect from '@/components/shared/CustomSelect';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import EmojiPickerModal from '@/components/modals/EmojiPickerModal';
import { DialogPortal } from '@/widgets/devices/ColorDialog';
import { BookmarkIcon } from '@/widgets/bookmarks/CalmeBookmarks';
import { childrenOf, folderOptions, hostOf, moveInto, removeItem } from '@/widgets/bookmarks/tree';
import { BookmarkDragScope, useBookmarkDrag } from '@/widgets/bookmarks/dnd';
import { importBookmarkHtml } from '@/widgets/bookmarks/importHtml';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading } from '../../shared/CalmeControls';
import { sourceId } from '../../shared/SourceList';

const URL_PATTERN = /^https?:\/\/\S+$/i;

/** What the edit dialog is open on: a new link or folder (in a folder), or an existing item. */
type Editing = { kind: 'link' | 'folder'; parentId?: string; item?: BookmarkItem } | null;

/**
 * The bookmarks library, saved once for every bookmarks widget: links and
 * folders (folders hold folders), in a tree moved by drag and drop. Adding
 * and editing happen in a small dialog; a browser's bookmarks file can be
 * imported. Saved as soon as it changes.
 */
export function BookmarksWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const items: BookmarkItem[] = config?.settings?.bookmarks ?? [];
  const save = (next: BookmarkItem[]) => void updateConfig({ bookmarks: next });
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const file = React.useRef<HTMLInputElement>(null);

  const remove = (item: BookmarkItem) => {
    const inside = items.filter(entry => entry.parentId === item.id).length;
    if (item.kind === 'folder' && inside > 0 && !window.confirm(t('settings.bookmarks.removeFolder', { name: item.title }))) return;
    save(removeItem(items, item.id));
  };

  // The file every browser exports (HTML): its folders and links join the library.
  const importFile = async (chosen: File | undefined) => {
    if (!chosen) return;
    const { items: added, skipped } = importBookmarkHtml(await chosen.text(), sourceId, items.length);
    if (added.length) save([...items, ...added]);
    setNotice(added.length ? [t('settings.bookmarks.imported', { count: added.filter(item => item.kind === 'link').length }), skipped ? t('settings.bookmarks.importSkipped', { count: skipped }) : ''].join(' ').trim() : t('settings.bookmarks.importEmpty'));
  };

  const rows = (parentId: string | undefined, depth: number): React.ReactNode[] => childrenOf(items, parentId).flatMap(item => [
    <LibraryRow key={item.id} item={item} depth={depth}
      onEdit={() => setEditing({ kind: item.kind, item })}
      onAdd={item.kind === 'folder' ? () => setEditing({ kind: 'link', parentId: item.id }) : undefined}
      onRemove={() => remove(item)} />,
    ...(item.kind === 'folder' ? rows(item.id, depth + 1) : []),
  ]);

  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="bookmarks" />
      <section className="ndc-set-block">
        <CalmeHeading
          info={t('settings.bookmarks.hint')}
          action={(
            <span className="ndc-bookmark-toolbar">
              <button type="button" className="nd-btn" onClick={() => file.current?.click()} title={t('settings.bookmarks.importHint')}><Upload size={13} />{t('settings.bookmarks.import')}</button>
              <button type="button" className="nd-btn" onClick={() => setEditing({ kind: 'folder' })}><FolderPlus size={13} />{t('settings.bookmarks.folder')}</button>
              <button type="button" className="nd-btn nd-btn-accent" onClick={() => setEditing({ kind: 'link' })}><Plus size={13} />{t('settings.bookmarks.link')}</button>
            </span>
          )}
        >
          {t('settings.bookmarks.library')}
        </CalmeHeading>
        <input ref={file} type="file" accept=".html,.htm,text/html" hidden onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ''; }} />
        {notice && <p className="ndw-note" role="status">{notice}</p>}
        {items.length === 0
          ? <p className="ndc-source-empty">{t('settings.bookmarks.empty')}</p>
          : (
            <BookmarkDragScope items={items} enabled={editing === null} onChange={save} overlay={item => <span className="ndc-bookmark-name"><BookmarkIcon item={item} size={16} /><span className="ndc-source-name">{item.title}</span></span>}>
              <ul className="ndc-set-list ndc-source-list" aria-label={t('settings.bookmarks.library')}>{rows(undefined, 0)}</ul>
            </BookmarkDragScope>
          )}
      </section>
      {editing && (
        <BookmarkDialog
          items={items}
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={item => { save(editing.item ? withEdit(items, item) : [...items, item]); setEditing(null); }}
        />
      )}
    </div>
  );
}

/** One library row: dragged by its grip onto another row (before, after, or inside a folder). */
function LibraryRow({ item, depth, onEdit, onAdd, onRemove }: { item: BookmarkItem; depth: number; onEdit: () => void; onAdd?: () => void; onRemove: () => void }) {
  const { t } = useI18n();
  const { attach, handle, dropClass } = useBookmarkDrag(item);
  return (
    <li ref={attach} className={`ndc-set-list-row ndc-bookmark-row ${dropClass}`} style={{ paddingLeft: depth * 20 }}>
      <span className="ndc-bookmark-name">
        <button type="button" className="ndc-bookmark-grip" {...handle} aria-label={t('widgets.bookmarks.move', { name: item.title })} title={t('widgets.bookmarks.move', { name: item.title })}><GripVertical size={13} /></button>
        <BookmarkIcon item={item} size={16} />
        <span className="ndc-source-text">
          <span className="ndc-source-name">{item.title}</span>
          {item.kind === 'link' && <span className="ndc-set-list-sub ndc-source-detail">{item.description || hostOf(item.url)}</span>}
        </span>
      </span>
      <span className="ndc-source-tools">
        {onAdd && <button type="button" className="ndc-icon-button" onClick={onAdd} aria-label={t('settings.bookmarks.addIn', { name: item.title })} title={t('settings.bookmarks.addIn', { name: item.title })}><Plus size={13} /></button>}
        <button type="button" className="ndc-icon-button" onClick={onEdit} aria-label={t('settings.bookmarks.edit', { name: item.title })} title={t('settings.bookmarks.edit', { name: item.title })}><Pencil size={13} /></button>
        <button type="button" className="ndc-icon-button is-danger" onClick={onRemove} aria-label={t('widgets.list.remove', { name: item.title })} title={t('widgets.list.remove', { name: item.title })}><X size={13} /></button>
      </span>
    </li>
  );
}

/** Replaces an item, moving it to the end of its new folder when the folder changed. */
function withEdit(items: BookmarkItem[], next: BookmarkItem): BookmarkItem[] {
  const before = items.find(item => item.id === next.id);
  const replaced = items.map(item => (item.id === next.id ? next : item));
  return before && (before.parentId ?? undefined) !== (next.parentId ?? undefined) ? moveInto(replaced, next.id, next.parentId) : replaced;
}

/** A link or a folder: icon and name, address and note for links, the folder it sits in. */
function BookmarkDialog({ items, editing, onClose, onSave }: { items: BookmarkItem[]; editing: NonNullable<Editing>; onClose: () => void; onSave: (item: BookmarkItem) => void }) {
  const { t } = useI18n();
  const initial = editing.item;
  const kind = editing.kind;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [parentId, setParentId] = useState(initial?.parentId ?? editing.parentId ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [picking, setPicking] = useState(false);
  const valid = title.trim() !== '' && (kind === 'folder' || URL_PATTERN.test(url.trim()));
  const folders = folderOptions(items, initial?.kind === 'folder' ? initial.id : undefined);
  const heading = t(initial ? (kind === 'folder' ? 'settings.bookmarks.editFolder' : 'settings.bookmarks.editLink') : (kind === 'folder' ? 'settings.bookmarks.newFolder' : 'settings.bookmarks.newLink'));
  const submit = () => {
    if (!valid) return;
    const item: BookmarkItem = { id: initial?.id ?? sourceId(kind), kind, title: title.trim().slice(0, 120) };
    if (kind === 'link') item.url = url.trim();
    if (parentId) item.parentId = parentId;
    if (kind === 'link' && description.trim()) item.description = description.trim().slice(0, 200);
    if (icon) item.icon = icon;
    if (initial?.color) item.color = initial.color;
    onSave(item);
  };
  const preview: BookmarkItem = { id: 'preview', kind, title: title || '?', url: URL_PATTERN.test(url.trim()) ? url.trim() : undefined, icon: icon || undefined };
  return (
    <DialogPortal onClose={onClose}>
      {ref => (
        <CalmeDialog
          dialogRef={ref}
          label={heading}
          title={heading}
          onClose={onClose}
          width={480}
          footer={<>
            <button type="button" className="nd-btn" onClick={onClose}>{t('Annuler')}</button>
            <button type="button" className="nd-btn nd-btn-accent" disabled={!valid} onClick={submit}>{t('Enregistrer')}</button>
          </>}
        >
          <form className="ndc-bookmark-dialog" onSubmit={event => { event.preventDefault(); submit(); }}>
            <CalmeField label={t(kind === 'folder' ? 'settings.bookmarks.folderName' : 'settings.bookmarks.title')} info={t('settings.bookmarks.iconHint')}>
              <span className="ndc-bookmark-title-row">
                <button type="button" className="ndc-bookmark-icon-pick" onClick={() => setPicking(true)} aria-label={t('settings.bookmarks.icon')} title={t(icon ? 'settings.bookmarks.icon' : 'settings.bookmarks.iconAuto')}>
                  <BookmarkIcon item={preview} size={20} />
                </button>
                <input className="nd-input" value={title} maxLength={120} autoFocus onChange={event => setTitle(event.target.value)} aria-label={t(kind === 'folder' ? 'settings.bookmarks.folderName' : 'settings.bookmarks.title')} />
              </span>
            </CalmeField>
            {kind === 'link' && (
              <>
                <CalmeField label={t('settings.bookmarks.url')}>
                  <input className="nd-input" type="url" inputMode="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" aria-label={t('settings.bookmarks.url')} />
                </CalmeField>
                <CalmeField label={t('settings.bookmarks.description')}>
                  <input className="nd-input" value={description} maxLength={200} onChange={event => setDescription(event.target.value)} aria-label={t('settings.bookmarks.description')} />
                </CalmeField>
              </>
            )}
            <CalmeField label={t('settings.bookmarks.in')}>
              <CustomSelect
                ariaLabel={t('settings.bookmarks.in')}
                value={parentId}
                onChange={setParentId}
                options={[{ value: '', label: t('settings.bookmarks.root') }, ...folders.map(({ folder, depth }) => ({ value: folder.id, label: `${'— '.repeat(depth)}${folder.title}` }))]}
              />
            </CalmeField>
            {/* Enter in a field saves. */}
            <button type="submit" hidden />
          </form>
          {picking && <EmojiPickerModal initialEmoji={icon} title={t('settings.bookmarks.icon')} onSelect={setIcon} onClose={() => setPicking(false)} />}
        </CalmeDialog>
      )}
    </DialogPortal>
  );
}
