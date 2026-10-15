import React, { useState } from 'react';
import { GripVertical, Pencil, Plus, Upload, X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import type { BookmarkItem } from '@/lib/widgetData/contracts';
import CustomSelect from '@/components/shared/CustomSelect';
import EmojiPickerModal from '@/components/modals/EmojiPickerModal';
import { BookmarkIcon } from '@/widgets/bookmarks/CalmeBookmarks';
import { childrenOf, folderOptions, hostOf, moveInto, removeItem } from '@/widgets/bookmarks/tree';
import { BookmarkDragScope, useBookmarkDrag } from '@/widgets/bookmarks/dnd';
import { importBookmarkHtml } from '@/widgets/bookmarks/importHtml';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeSegmented } from '../../shared/CalmeControls';
import { sourceId } from '../../shared/SourceList';

const URL_PATTERN = /^https?:\/\/\S+$/i;

/**
 * The bookmarks library, saved once for every bookmarks widget: links and
 * folders (folders can hold folders). Each widget then opens it at the folder
 * it chooses. Saved as soon as it changes.
 */
export function BookmarksWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const items: BookmarkItem[] = config?.settings?.bookmarks ?? [];
  const save = (next: BookmarkItem[]) => void updateConfig({ bookmarks: next });
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const file = React.useRef<HTMLInputElement>(null);

  // The file every browser exports (HTML): its folders and links join the library.
  const importFile = async (chosen: File | undefined) => {
    if (!chosen) return;
    const { items: added, skipped } = importBookmarkHtml(await chosen.text(), sourceId, items.length);
    if (added.length) save([...items, ...added]);
    setNotice(added.length ? [t('settings.bookmarks.imported', { count: added.filter(item => item.kind === 'link').length }), skipped ? t('settings.bookmarks.importSkipped', { count: skipped }) : ''].join(' ').trim() : t('settings.bookmarks.importEmpty'));
  };

  const remove = (item: BookmarkItem) => {
    const inside = items.filter(entry => entry.parentId === item.id).length;
    if (item.kind === 'folder' && inside > 0 && !window.confirm(t('settings.bookmarks.removeFolder', { name: item.title }))) return;
    save(removeItem(items, item.id));
  };

  const rows = (parentId: string | undefined, depth: number): React.ReactNode[] => childrenOf(items, parentId).flatMap(item => [
    editing === item.id
      ? <li key={item.id} style={{ paddingLeft: depth * 18 }}><BookmarkForm items={items} initial={item} onCancel={() => setEditing(null)} onSave={next => { save(withEdit(items, next)); setEditing(null); }} /></li>
      : <LibraryRow key={item.id} item={item} depth={depth} onEdit={() => setEditing(item.id)} onRemove={() => remove(item)} />,
    ...(item.kind === 'folder' ? rows(item.id, depth + 1) : []),
  ]);

  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="bookmarks" />
      <section className="ndc-set-block">
        <CalmeHeading
          info={t('settings.bookmarks.hint')}
          action={<button type="button" className="nd-btn" onClick={() => file.current?.click()} title={t('settings.bookmarks.importHint')}><Upload size={13} />{t('settings.bookmarks.import')}</button>}
        >
          {t('settings.bookmarks.library')}
        </CalmeHeading>
        <input ref={file} type="file" accept=".html,.htm,text/html" hidden onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ''; }} />
        {notice && <p className="ndw-note" role="status">{notice}</p>}
        <BookmarkForm items={items} onSave={item => save([...items, item])} />
        {items.length === 0
          ? <p className="ndc-source-empty">{t('settings.bookmarks.empty')}</p>
          : (
            <BookmarkDragScope items={items} enabled={editing === null} onChange={save} overlay={item => <span className="ndc-bookmark-name"><BookmarkIcon item={item} size={16} /><span className="ndc-source-name">{item.title}</span></span>}>
              <ul className="ndc-set-list ndc-source-list" aria-label={t('settings.bookmarks.library')}>{rows(undefined, 0)}</ul>
            </BookmarkDragScope>
          )}
      </section>
    </div>
  );
}

/** One library row: dragged by its grip onto another row (before, after, or inside a folder). */
function LibraryRow({ item, depth, onEdit, onRemove }: { item: BookmarkItem; depth: number; onEdit: () => void; onRemove: () => void }) {
  const { t } = useI18n();
  const { attach, handle, dropClass, enabled: dragging } = useBookmarkDrag(item);
  return (
    <li ref={attach} className={`ndc-set-list-row ndc-bookmark-row ${dropClass}`} style={{ paddingLeft: depth * 18 }}>
      <span className="ndc-bookmark-name">
        <button type="button" className="ndc-bookmark-grip" {...handle} aria-label={t('widgets.bookmarks.move', { name: item.title })} title={t('widgets.bookmarks.move', { name: item.title })}><GripVertical size={13} /></button>
        <BookmarkIcon item={item} size={16} />
        <span className="ndc-source-text">
          <span className="ndc-source-name">{item.title}</span>
          {item.kind === 'link' && <span className="ndc-set-list-sub ndc-source-detail">{hostOf(item.url)}</span>}
        </span>
      </span>
      <span className="ndc-source-tools">
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

/** Adds a link or a folder, or edits one in place (`initial`). */
function BookmarkForm({ items, initial, onSave, onCancel }: { items: BookmarkItem[]; initial?: BookmarkItem; onSave: (item: BookmarkItem) => void; onCancel?: () => void }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<'link' | 'folder'>(initial?.kind ?? 'link');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [parentId, setParentId] = useState(initial?.parentId ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [picking, setPicking] = useState(false);
  const valid = title.trim() !== '' && (kind === 'folder' || URL_PATTERN.test(url.trim()));
  const submit = () => {
    if (!valid) return;
    const item: BookmarkItem = { id: initial?.id ?? sourceId(kind), kind, title: title.trim().slice(0, 120) };
    if (kind === 'link') item.url = url.trim();
    if (parentId) item.parentId = parentId;
    if (kind === 'link' && description.trim()) item.description = description.trim().slice(0, 200);
    if (icon) item.icon = icon;
    if (initial?.color) item.color = initial.color;
    onSave(item);
    if (!initial) { setTitle(''); setUrl(''); setDescription(''); setIcon(''); }
  };
  const folders = folderOptions(items, initial?.kind === 'folder' ? initial.id : undefined);
  return (
    <form className={`ndc-bookmark-form ${initial ? 'is-editing' : ''}`} onSubmit={event => { event.preventDefault(); submit(); }}>
      {!initial && (
        <CalmeSegmented label={t('settings.bookmarks.kind')} value={kind} options={[{ value: 'link', label: t('settings.bookmarks.link') }, { value: 'folder', label: t('settings.bookmarks.folder') }]} onChange={value => setKind(value as 'link' | 'folder')} />
      )}
      <div className="ndc-bookmark-fields">
        <input className="nd-input" value={title} maxLength={120} onChange={event => setTitle(event.target.value)} placeholder={t(kind === 'folder' ? 'settings.bookmarks.folderName' : 'settings.bookmarks.title')} aria-label={t(kind === 'folder' ? 'settings.bookmarks.folderName' : 'settings.bookmarks.title')} />
        {kind === 'link' && <input className="nd-input" type="url" inputMode="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" aria-label={t('settings.bookmarks.url')} />}
        {kind === 'link' && <input className="nd-input ndc-bookmark-wide" value={description} maxLength={200} onChange={event => setDescription(event.target.value)} placeholder={t('settings.bookmarks.description')} aria-label={t('settings.bookmarks.description')} />}
        <CustomSelect
          ariaLabel={t('settings.bookmarks.in')}
          value={parentId}
          onChange={setParentId}
          options={[{ value: '', label: t('settings.bookmarks.root') }, ...folders.map(({ folder, depth }) => ({ value: folder.id, label: `${'— '.repeat(depth)}${folder.title}` }))]}
        />
      </div>
      <div className="ndc-bookmark-actions">
        <button type="button" className="nd-btn nd-btn-compact ndc-bookmark-icon-button" onClick={() => setPicking(true)} title={t('settings.bookmarks.icon')}>
          <BookmarkIcon item={{ id: 'preview', kind, title: title || '?', url: url || undefined, icon: icon || undefined }} size={14} />{t('settings.bookmarks.icon')}
        </button>
        {onCancel && <button type="button" className="nd-btn nd-btn-compact" onClick={onCancel}>{t('Annuler')}</button>}
        <button type="submit" className="nd-btn nd-btn-compact nd-btn-accent" disabled={!valid}>{initial ? t('Enregistrer') : <><Plus size={12} />{t('settings.add')}</>}</button>
      </div>
      {picking && <EmojiPickerModal initialEmoji={icon} title={t('settings.bookmarks.icon')} onSelect={setIcon} onClose={() => setPicking(false)} />}
    </form>
  );
}
