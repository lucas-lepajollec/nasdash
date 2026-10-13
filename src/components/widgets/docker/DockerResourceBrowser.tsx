'use client';

import { Fragment, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowDownWideNarrow, ArrowUpWideNarrow, Box, ChevronDown, ChevronLeft, ChevronRight, HardDrive, Loader2, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog } from '@/components/shared/CalmeDialog';
import CustomSelect from '@/components/shared/CustomSelect';
import { demoFetch } from '@/lib/demoTransport';
import { dockerActionError, readDockerResponse } from '@/lib/dockerErrorContract';
import { deletableSelection, resourceList, resourcePage, type DockerResourceRow, type ResourceFilter, type ResourceSort } from '@/lib/dockerResourceList';

const mobileQuery = '(max-width: 767px)';
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const desktopSnapshot = () => false;
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

export function DockerResourceBrowser({ kind, rows, hostId, loading, errorNotice, refresh, formatSize }: {
  kind: 'images' | 'volumes'; rows: DockerResourceRow[]; hostId: string; loading: boolean;
  errorNotice?: React.ReactNode; refresh: () => void; formatSize: (size: number) => string;
}) {
  const { t, locale } = useI18n();
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  const id = useId();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ResourceFilter>('all');
  const [sort, setSort] = useState<ResourceSort>('name');
  const [descending, setDescending] = useState(false);
  const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, desktopSnapshot);
  const [chosenPageSize, setPageSize] = useState<number | null>(null);
  const pageSize = chosenPageSize ?? (isMobile ? 5 : 10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [targets, setTargets] = useState<Array<{ id: string; name: string }> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failures, setFailures] = useState<Array<{ id: string; name: string; message: string }>>([]);
  const latestRows = useRef(rows);
  const allCheckbox = useRef<HTMLInputElement>(null);
  const dialogRef = useDialogAccessibility(() => { if (!deleting) setTargets(null); }, !!targets);
  useEffect(() => { latestRows.current = rows; }, [rows]);

  const imageMode = kind === 'images';
  const Icon = imageMode ? Box : HardDrive;
  const filtered = resourceList(rows, query, filter, sort, descending, locale);
  const current = resourcePage(filtered, page, pageSize);
  const selectedIds = deletableSelection(selected, rows);
  // Adjust before rendering children so vanished/newly used resources cannot become selected again later.
  if (selectedIds.length !== selected.length) setSelected(selectedIds);
  const pageIds = current.rows.filter(row => !row.used).map(row => row.id);
  const pageSelected = pageIds.filter(value => selectedIds.includes(value)).length;
  const allSelected = pageIds.length > 0 && pageSelected === pageIds.length;
  useEffect(() => { if (allCheckbox.current) allCheckbox.current.indeterminate = pageSelected > 0 && !allSelected; }, [pageSelected, allSelected]);
  const unavailable = loading || !!errorNotice;
  const blocked = targets?.some(target => !rows.some(row => row.id === target.id && !row.used)) || unavailable;
  const resetSelection = () => { setSelected([]); setPage(1); };
  const openDelete = (ids: string[]) => {
    const allowed = deletableSelection(ids, rows);
    if (!allowed.length || unavailable) return;
    setFailures([]);
    setTargets(allowed.map(value => ({ id: value, name: rows.find(row => row.id === value)!.name })));
  };
  const handleDelete = async () => {
    if (!targets?.length || deleting || blocked) return;
    setDeleting(true);
    setFailures([]);
    const failed: typeof failures = [];
    for (const target of targets) {
      // A refresh may attach a volume/image during a bulk operation. The server remains authoritative.
      if (!latestRows.current.some(row => row.id === target.id && !row.used)) {
        failed.push({ ...target, message: t('docker.resources.changed') });
        continue;
      }
      try {
        await readDockerResponse(await demoFetch(`/api/docker/${encodeURIComponent(hostId)}/${kind}?${imageMode ? 'id' : 'name'}=${encodeURIComponent(target.id)}`, { method: 'DELETE' }));
      } catch (error: unknown) {
        failed.push({ ...target, message: dockerActionError(error, t) });
      }
    }
    setFailures(failed);
    setTargets(failed.length ? failed.map(({ id: targetId, name }) => ({ id: targetId, name })) : null);
    setSelected(failed.map(target => target.id));
    setDeleting(false);
    refresh();
  };
  const timestamp = (value?: number) => value === undefined ? t('docker.resources.notReported') : new Date(value * 1000).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });

  return <section className="nd-docker-resources" aria-label={t(imageMode ? 'Images' : 'Volumes')} aria-busy={loading}>
    <div className="nd-docker-resource-heading">
      <div className="nd-docker-resource-title"><Icon size={18} aria-hidden="true" /><h3>{t(imageMode ? 'Images' : 'Volumes')}</h3><span>{rows.length}</span></div>
      <button type="button" className="nd-btn" onClick={refresh} disabled={loading || deleting}><RotateCcw size={14} aria-hidden="true" />{t('docker.resources.refresh')}</button>
    </div>
    <p className="nd-docker-resource-summary">
      <span>{t('docker.resources.usedCount', { count: rows.filter(row => row.used).length })}</span>
      <span>{t('docker.resources.unusedCount', { count: rows.filter(row => !row.used).length })}</span>
    </p>
    <div className="nd-docker-resource-tools">
      <div className="nd-docker-resource-query">
        <label className="nd-docker-resource-checkbox" title={t('docker.resources.selectPage')}>
          <input ref={allCheckbox} type="checkbox" checked={allSelected} disabled={!pageIds.length || unavailable || deleting} onChange={() => setSelected(allSelected ? selectedIds.filter(value => !pageIds.includes(value)) : [...new Set([...selectedIds, ...pageIds])])} />
          <span className="nd-sr-only">{t('docker.resources.selectPage')}</span>
        </label>
        <label className="nd-docker-resource-search"><span className="nd-sr-only">{t('docker.resources.search')}</span><Search size={15} aria-hidden="true" />
          <input className="nd-input" type="search" value={query} placeholder={t('docker.resources.search')} onChange={event => { setQuery(event.target.value); resetSelection(); }} onKeyDown={event => { if (event.key === 'Escape') { setQuery(''); resetSelection(); } }} />
          {query && <button type="button" className="ndc-icon-button" aria-label={t('docker.resources.clearSearch')} onClick={() => { setQuery(''); resetSelection(); }}><X size={14} /></button>}
        </label>
      </div>
      <CustomSelect ariaLabel={t('Statut')} value={filter} onChange={value => { setFilter(value as ResourceFilter); resetSelection(); }} options={[
        { value: 'all', label: t('docker.resources.all') }, { value: 'used', label: t('docker.resources.used') }, { value: 'unused', label: t('docker.resources.unused') },
        ...(imageMode ? [{ value: 'untagged', label: t('docker.image.untagged') }] : []),
      ]} />
      <div className="nd-docker-resource-sort"><CustomSelect ariaLabel={t('docker.resources.sort')} value={sort} onChange={value => { setSort(value as ResourceSort); setPage(1); }} options={[
        { value: 'name', label: t('Nom') }, { value: 'created', label: t('Créé') }, { value: 'size', label: t('Taille') }, ...(!imageMode ? [{ value: 'driver', label: t('Driver') }] : []),
      ]} /><button type="button" className="nd-btn" aria-label={t(descending ? 'docker.resources.descending' : 'docker.resources.ascending')} title={t(descending ? 'docker.resources.descending' : 'docker.resources.ascending')} onClick={() => { setDescending(!descending); setPage(1); }}>{descending ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}</button></div>
    </div>
    {selectedIds.length > 0 && <div className="nd-docker-resource-selection">
      <span>{t('docker.resources.selected', { count: selectedIds.length })}</span>
      <div><button type="button" className="nd-btn" onClick={() => setSelected([])} disabled={deleting}>{t('docker.resources.clearSelection')}</button>
        <button type="button" className="nd-btn ndc-danger-ghost" disabled={unavailable || deleting} onClick={() => openDelete(selectedIds)}><Trash2 size={14} />{t('Supprimer la sélection')}</button></div>
    </div>}
    {errorNotice ? <div>{errorNotice}<button type="button" className="nd-btn" onClick={refresh}>{t('Réessayer')}</button></div> : loading && rows.length === 0 ? <div className="nd-docker-resource-empty" role="status"><Loader2 className="nd-spin" size={22} /><span>{t('docker.resources.loading')}</span></div> : <>
      <div className="nd-docker-detail nd-docker-resource-list">

        <table className="nd-docker-resource-table" aria-label={t(imageMode ? 'Images' : 'Volumes')}>
          <colgroup><col className="nd-docker-resource-check-col" /><col /><col className="nd-docker-resource-status-col" /><col className="nd-docker-resource-meta-col" /><col className="nd-docker-resource-actions-col" /></colgroup>
          <thead><tr><th><span className="nd-sr-only">{t('docker.resources.selected', { count: selectedIds.length })}</span></th><th scope="col">{t(imageMode ? 'Image' : 'Volume')}</th><th scope="col">{t('Statut')}</th><th scope="col">{t(imageMode ? 'Taille' : 'Driver')}</th><th scope="col"><span className="nd-sr-only">{t('Actions')}</span></th></tr></thead>
          <tbody>{current.rows.map((row, index) => {
            const isExpanded = expanded.includes(row.id);
            const detailsId = `${id}-details-${index}`;
            return <Fragment key={row.id}>
              <tr data-resource-id={row.id} className={`nd-docker-resource-row${selectedIds.includes(row.id) ? ' is-selected' : ''}${row.highlighted ? ' is-highlighted' : ''}`}>
                <td className="nd-docker-resource-check"><label className="nd-docker-resource-checkbox"><input type="checkbox" aria-label={t('docker.resources.selectNamed', { name: row.name })} checked={selectedIds.includes(row.id)} disabled={row.used || unavailable || deleting} onChange={() => setSelected(selectedIds.includes(row.id) ? selectedIds.filter(value => value !== row.id) : [...selectedIds, row.id])} /></label></td>
                <td className="nd-docker-resource-name"><strong>{row.name}</strong><div className="nd-docker-resource-subline">{imageMode ? <><code>{row.id.replace(/^sha256:/, '').slice(0, 12)}</code>{!row.tags.length && <span>{t('docker.image.untagged')}</span>}{row.tags.length > 1 && <span>{t('docker.resources.moreTags', { count: row.tags.length - 1 })}</span>}</> : <span>{row.consumers.length ? row.consumers.join(', ') : t('docker.resources.noKnownContainer')}</span>}</div></td>
                <td className="nd-docker-resource-status"><span className={`nd-docker-resource-badge${row.used ? ' is-used' : ''}`} title={t(row.used ? 'docker.resources.usedHint' : 'docker.resources.unusedHint')}><span aria-hidden="true" />{t(row.used ? 'docker.resources.used' : 'docker.resources.unused')}</span>{row.highlighted && <small>{t('docker.resources.linked')}</small>}</td>
                <td className="nd-docker-resource-meta"><span>{imageMode ? row.size === undefined ? t('docker.resources.notReported') : formatSize(row.size) : row.driver || t('docker.resources.notReported')}</span><small>{timestamp(row.created)}</small></td>
                <td className="nd-docker-resource-actions"><button type="button" className="nd-btn" aria-label={t('docker.resources.detailsNamed', { name: row.name })} title={t('docker.resources.details')} aria-expanded={isExpanded} aria-controls={detailsId} onClick={() => setExpanded(isExpanded ? expanded.filter(value => value !== row.id) : [...expanded, row.id])}><ChevronDown size={16} className={isExpanded ? 'is-open' : ''} /></button>
                  <button type="button" className="nd-btn ndc-danger-ghost" aria-label={t('Supprimer')} title={t(row.used ? 'docker.resources.usedHint' : 'Supprimer')} disabled={row.used || unavailable || deleting} onClick={() => openDelete([row.id])}><Trash2 size={15} /></button></td>
              </tr>
              {isExpanded && <tr className="nd-docker-resource-details-row"><td colSpan={5}><div id={detailsId} className="nd-docker-resource-details">
                <dl><div><dt>{t(imageMode ? 'docker.resources.identifier' : 'Volume')}</dt><dd><code>{row.id}</code></dd></div>
                  {!!row.tags.length && <div><dt>{t('docker.resources.tags')}</dt><dd>{row.tags.map(tag => <code key={tag}>{tag}</code>)}</dd></div>}
                  {!!row.digests.length && <div><dt>{t('docker.resources.digests')}</dt><dd>{row.digests.map(digest => <code key={digest}>{digest}</code>)}</dd></div>}
                  {!imageMode && <><div><dt>{t('Mountpoint')}</dt><dd><code>{row.mountpoint || t('docker.resources.notReported')}</code></dd></div><div><dt>{t('Taille')}</dt><dd>{row.size === undefined ? t('docker.resources.notReported') : formatSize(row.size)}</dd></div></>}
                  <div><dt>{t('Créé')}</dt><dd>{timestamp(row.created)}</dd></div><div><dt>{t('docker.resources.containers')}</dt><dd>{row.consumers.length ? row.consumers.map(name => <span key={name}>{name}</span>) : t(row.used ? 'docker.resources.providerUsed' : 'docker.resources.noKnownContainer')}</dd></div>
                </dl><p>{t(row.used ? 'docker.resources.usedHint' : 'docker.resources.unusedHint')}</p>
              </div></td></tr>}
            </Fragment>;
          })}</tbody>
        </table>
        {!current.rows.length && <div className="nd-docker-resource-empty"><Icon size={24} /><strong>{t(rows.length ? 'docker.resources.noMatches' : imageMode ? 'Aucune image' : 'Aucun volume')}</strong>{rows.length > 0 && <button type="button" className="nd-btn" onClick={() => { setQuery(''); setFilter('all'); resetSelection(); }}>{t('docker.resources.resetFilters')}</button>}</div>}
      </div>
      <div className="nd-docker-resource-pagination">
        <span role="status">{t('docker.resources.range', { start: current.start, end: current.end, total: filtered.length })}</span>
        <div className="nd-docker-resource-page-size"><span>{t('docker.resources.perPage')}</span><CustomSelect ariaLabel={t('docker.resources.perPage')} value={String(pageSize)} onChange={value => { setPageSize(Number(value)); setPage(1); }} options={[5, 10, 25, 50].map(size => ({ value: String(size), label: String(size) }))} /></div>
        <nav aria-label={t('docker.resources.pagination')}><button type="button" className="nd-btn" aria-label={t('docker.resources.previous')} disabled={current.page === 1} onClick={() => setPage(current.page - 1)}><ChevronLeft size={16} /></button><span>{t('docker.resources.page', { page: current.page, total: current.pageCount })}</span><button type="button" className="nd-btn" aria-label={t('docker.resources.next')} disabled={current.page === current.pageCount} onClick={() => setPage(current.page + 1)}><ChevronRight size={16} /></button></nav>
      </div>
      <p className="nd-docker-resource-hint">{t('docker.resources.usedHint')}</p>
    </>}
    {targets && typeof document !== 'undefined' && createPortal(<div className="nd-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setTargets(null); }}>
      <CalmeDialog dialogRef={dialogRef} label={t(imageMode ? targets.length > 1 ? 'docker.deleteImagesTitle' : 'docker.deleteImageTitle' : targets.length > 1 ? 'docker.deleteVolumesTitle' : 'docker.deleteVolumeTitle')} title={t(imageMode ? targets.length > 1 ? 'docker.deleteImagesTitle' : 'docker.deleteImageTitle' : targets.length > 1 ? 'docker.deleteVolumesTitle' : 'docker.deleteVolumeTitle')} onClose={() => { if (!deleting) setTargets(null); }} className="nd-docker-resource-confirm" footer={<>
        <button type="button" className="nd-btn" disabled={deleting} onClick={() => setTargets(null)}>{t('Annuler')}</button><button type="button" className="nd-btn ndc-btn-danger" disabled={deleting || blocked} aria-busy={deleting} onClick={() => { void handleDelete(); }}>{deleting ? <Loader2 size={14} className="nd-spin" /> : <Trash2 size={14} />}{t('Supprimer')}</button>
      </>}>
        <p className="ndc-dialog-hint">{demoMode ? t(imageMode ? 'Cette action est simulée et temporaire.' : 'Cette suppression est simulée et réversible en réinitialisant la démo. Aucun volume ni fichier réel ne sera touché.') : t(imageMode ? 'docker.confirmImageDelete' : 'docker.confirmVolumeDelete', { target: t(imageMode ? 'docker.imagesCount' : 'docker.volumesCount', { count: targets.length }) })}</p>
        <ul className="nd-docker-resource-targets">{targets.map(target => <li key={target.id}><Icon size={16} /><span>{target.name}</span></li>)}</ul>
        {blocked && <p role="alert" className="nd-docker-resource-error"><AlertCircle size={16} />{t('docker.resources.changed')}</p>}
        {failures.length > 0 && <div role="alert" className="nd-docker-resource-error"><AlertCircle size={16} /><div><p>{t('docker.resources.retryFailed')}</p>{failures.map(failure => <p key={failure.id}><strong>{failure.name}</strong><br />{failure.message}</p>)}</div></div>}
      </CalmeDialog>
    </div>, document.body)}
  </section>;
}
