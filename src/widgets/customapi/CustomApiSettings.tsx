'use client';

import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Plus, RefreshCw, SlidersHorizontal, Table2, X } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { CUSTOM_API_TYPES, type CustomApiField, type CustomApiFormat, type CustomApiSample } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { demoFetch } from '@/lib/demoTransport';
import { CalmeField } from '@/components/shared/CalmeDialog';
import CustomSelect from '@/components/shared/CustomSelect';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { sourceId } from '@/components/modals/settings/shared/SourceList';
import { bounded, pick } from '@/components/widgets/content/kit';
import { chosenConnection, ConnectionPicker } from '@/components/widgets/content/ConnectionPicker';
import { DISPLAYS, fieldsOf, REFRESHES } from './CalmeCustomApi';
import { dateOf } from './format';

const FORMATS: readonly CustomApiFormat[] = ['auto', 'number', 'percent', 'bytes', 'bitrate', 'duration', 'date', 'relative', 'text', 'boolean'];
const NAME = /^[A-Za-z0-9_$-]+$/;
const MAX_FIELDS = 12;
/** Shown when the server could not be reached at all. */
const NETWORK = ['widgets', 'error', 'network'].join('.');

/** The next step of a path: `.name` or `[n]` (a name the server would refuse cannot be picked). */
function stepOf(base: string, key: string | number): string | null {
  if (typeof key === 'number') return `${base}[${key}]`;
  if (!NAME.test(key) || ['__proto__', 'prototype', 'constructor'].includes(key)) return null;
  return base ? `${base}.${key}` : key;
}

/** The value at a path of the sample (the same grammar as the server). */
function valueAt(root: unknown, path: string): unknown {
  let current = root;
  for (const part of path.match(/[^.[\]]+|\[\d+\]/g) ?? []) {
    if (current === null || typeof current !== 'object') return undefined;
    const key = part.startsWith('[') ? Number(part.slice(1, -1)) : part;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/** A readable label from a path's last name: `cpu_temp` → "Cpu temp". */
function labelOf(path: string): string {
  const last = (path.match(/[A-Za-z0-9_$-]+(?=[^A-Za-z0-9_$-]*$)/)?.[0] ?? path).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return (last.charAt(0).toUpperCase() + last.slice(1)).slice(0, 60);
}

/** A sensible format for a sample value. */
function guessFormat(value: unknown): CustomApiFormat {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string' && !Number.isFinite(Number(value)) && dateOf(value) !== undefined && /\d{4}-\d{2}-\d{2}/.test(value)) return 'relative';
  if (typeof value === 'string' && !Number.isFinite(Number(value))) return 'text';
  return 'auto';
}

/**
 * The widget's dialog: its connection and title, how it shows the values,
 * and the values themselves, picked by clicking them in the API's answer
 * (fetched once by the server, administrators only).
 */
export function CustomApiSettings({ draft, change }: { draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const connection = chosenConnection(config?.integrations, CUSTOM_API_TYPES, draft.integrationId);
  const display = pick(draft.display, DISPLAYS, 'figures');
  const fields = fieldsOf(draft);
  const listPath = typeof draft.listPath === 'string' ? draft.listPath : '';
  const okPath = typeof draft.okPath === 'string' ? draft.okPath : '';
  // Saved as plain JSON: unset options are left out.
  const setFields = (next: CustomApiField[]) => change({ fields: JSON.parse(JSON.stringify(next)) as WidgetSettings[string] });
  const sample = useSample(connection?.id);

  const add = (path: string, value: unknown) => {
    if (fields.length >= MAX_FIELDS || fields.some(field => field.path === path)) return;
    setFields([...fields, { id: sourceId('field'), path, label: labelOf(path), format: guessFormat(value) }]);
  };
  // Table rows are read from the first item of the chosen list.
  const explorerRoot = display === 'table' && listPath ? valueAt(sample.data?.sample, `${listPath}[0]`) : sample.data?.sample;

  return (
    <div className="ndw-api-settings">
      <div className="ndw-api-settings-main">
        <div className="ndw-mx-notice" role="note">
          <span className="ndw-mx-notice-title">{t('widgets.customapi.experimental')}</span>
          <span className="ndw-media-sub">{t('widgets.customapi.experimentalHint')}</span>
        </div>
        <CalmeField label={t('widgets.connection')}>
          <ConnectionPicker types={CUSTOM_API_TYPES} section="custom" value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id })} />
        </CalmeField>
        <CalmeField label={t('widgets.customapi.title')}>
          <input className="nd-input" value={typeof draft.title === 'string' ? draft.title : ''} maxLength={60} placeholder={t('widget.customapi.name')} onChange={event => change({ title: event.target.value || null })} />
        </CalmeField>
        <CalmeField label={t('widgets.display')}>
          <CalmeSegmented label={t('widgets.display')} value={display} options={DISPLAYS.map(value => ({ value, label: t(`widgets.customapi.display.${value}`) }))} onChange={value => change({ display: value })} />
        </CalmeField>

        {display === 'table' && (
          <CalmeField label={t('widgets.customapi.listPath')} info={t('widgets.customapi.listPathHint')}>
            {listPath
              ? <span className="ndw-api-path-chip"><Table2 size={12} />{listPath}<button type="button" className="ndc-icon-button" onClick={() => change({ listPath: null, fields: [] })} aria-label={t('widgets.list.remove', { name: listPath })}><X size={12} /></button></span>
              : <p className="ndw-note">{t('widgets.customapi.listPathPick')}</p>}
          </CalmeField>
        )}
        {display === 'table' && listPath && (
          <CalmeRow label={t('widgets.customapi.limit')}>
            <CalmeSlider label={t('widgets.customapi.limit')} value={bounded(draft.limit, 1, 50, 10)} min={1} max={50} step={1} onChange={value => change({ limit: value })} onCommit={value => change({ limit: value })} format={String} />
          </CalmeRow>
        )}
        {display === 'status' && (
          <>
            <CalmeField label={t('widgets.customapi.okPath')} info={t('widgets.customapi.okPathHint')}>
              {okPath
                ? <span className="ndw-api-path-chip">{okPath}<button type="button" className="ndc-icon-button" onClick={() => change({ okPath: null })} aria-label={t('widgets.list.remove', { name: okPath })}><X size={12} /></button></span>
                : <p className="ndw-note">{t('widgets.customapi.okPathPick')}</p>}
            </CalmeField>
            <div className="ndw-api-two">
              <CalmeField label={t('widgets.customapi.okValue')} info={t('widgets.customapi.okValueHint')}>
                <input className="nd-input" value={draft.okValue === undefined || draft.okValue === null ? '' : String(draft.okValue)} maxLength={100} onChange={event => change({ okValue: event.target.value === '' ? null : event.target.value })} />
              </CalmeField>
              <CalmeField label={t('widgets.customapi.statusLabel')}>
                <input className="nd-input" value={typeof draft.statusLabel === 'string' ? draft.statusLabel : ''} maxLength={60} onChange={event => change({ statusLabel: event.target.value || null })} />
              </CalmeField>
            </div>
          </>
        )}

        <CalmeField label={display === 'status' ? t('widgets.customapi.extraFields') : t('widgets.customapi.fields')} info={t('widgets.customapi.fieldsHint')}>
          {fields.length === 0
            ? <p className="ndw-note">{t(display === 'table' && !listPath ? 'widgets.customapi.listPathPick' : 'widgets.customapi.noField')}</p>
            : <ul className="ndw-api-fields">{fields.map((field, index) => (
              <FieldRow key={field.id} field={field} display={display} first={index === 0} last={index === fields.length - 1}
                onChange={next => setFields(fields.map(item => (item.id === field.id ? next : item)))}
                onMove={step => { const next = [...fields]; [next[index], next[index + step]] = [next[index + step], next[index]]; setFields(next); }}
                onRemove={() => setFields(fields.filter(item => item.id !== field.id))} />
            ))}</ul>}
        </CalmeField>

        <CalmeField label={t('widgets.customapi.refresh')}>
          <CalmeSegmented label={t('widgets.customapi.refresh')} value={pick(String(draft.refresh), REFRESHES, '60')} options={REFRESHES.map(value => ({ value, label: t(`widgets.customapi.refresh.${value}`) }))} onChange={value => change({ refresh: Number(value) })} />
        </CalmeField>
      </div>

      <aside className="ndw-api-explorer" aria-label={t('widgets.customapi.answer')}>
        <div className="ndw-api-explorer-head">
          <span>{display === 'table' && listPath ? t('widgets.customapi.answerRow') : t('widgets.customapi.answer')}</span>
          {connection && <button type="button" className="ndc-icon-button" onClick={sample.reload} disabled={sample.loading} aria-label={t('widgets.customapi.reload')} title={t('widgets.customapi.reload')}><RefreshCw size={13} className={sample.loading ? 'nd-spin' : undefined} /></button>}
        </div>
        {!connection ? <p className="ndw-note">{t('widgets.customapi.chooseConnection')}</p>
          : 'failure' in sample && sample.failure ? <p className="ndw-note ndw-down">{t(sample.failure)}</p>
            : !sample.data ? <p className="ndw-note">{t('widgets.customapi.loading')}</p>
              : explorerRoot === undefined ? <p className="ndw-note">{t('widgets.customapi.noRows')}</p>
                : (
                  <div className="ndw-api-tree">
                    <JsonNode value={explorerRoot} path="" depth={0} picked={new Set(fields.map(field => field.path))}
                      onPick={display === 'status' && !okPath ? (path => change({ okPath: path })) : add}
                      onList={display === 'table' && !listPath ? (path => change({ listPath: path, fields: [] })) : undefined}
                      full={fields.length >= MAX_FIELDS} />
                    {sample.data.truncated && <p className="ndw-note">{t('widgets.customapi.truncated')}</p>}
                  </div>
                )}
      </aside>
    </div>
  );
}

/** The API's answer for picking, asked to the server (administrators only); `reload` asks again. */
function useSample(integrationId: string | undefined) {
  const [state, setState] = useState<{ id?: string; data?: CustomApiSample; failure?: string; loading: boolean }>({ loading: false });
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!integrationId) return;
    let cancelled = false;
    demoFetch(`/api/widgets/customapi/sample?${new URLSearchParams({ integrationId })}`)
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        setState(response.ok ? { id: integrationId, data: payload as CustomApiSample, loading: false } : { id: integrationId, failure: typeof payload?.error === 'string' ? payload.error : NETWORK, loading: false });
      })
      .catch(() => { if (!cancelled) setState({ id: integrationId, failure: NETWORK, loading: false }); });
    return () => { cancelled = true; };
  }, [integrationId, round]);
  const current = state.id === integrationId ? state : { loading: true };
  return { ...current, loading: current.loading || (state.id === integrationId && round > 0 && state.loading), reload: () => { setState(previous => ({ ...previous, loading: true })); setRound(value => value + 1); } };
}

/** One node of the answer: objects and arrays fold open, values can be picked. */
function JsonNode({ value, path, name, depth, picked, onPick, onList, full }: {
  value: unknown; path: string; name?: string | number; depth: number; picked: Set<string>;
  onPick: (path: string, value: unknown) => void; onList?: (path: string) => void; full: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(depth < 2);
  const label = name === undefined ? t('widgets.customapi.root') : typeof name === 'number' ? `[${name}]` : name;
  if (value !== null && typeof value === 'object') {
    const entries: [string | number, unknown][] = Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value as Record<string, unknown>);
    const listable = Array.isArray(value) && value.some(item => item && typeof item === 'object') && onList && path;
    return (
      <div className="ndw-api-node">
        <div className="ndw-api-node-row">
          <button type="button" className="ndw-api-node-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
            <ChevronRight size={12} className={open ? 'is-open' : undefined} aria-hidden="true" />
            <span className="ndw-api-key">{label}</span>
            <span className="ndw-api-kind">{t(Array.isArray(value) ? 'widgets.customapi.items' : 'widgets.customapi.keys', { count: Array.isArray(value) ? value.length : entries.length })}</span>
          </button>
          {Array.isArray(value) && path && <PickButton path={stepOf(path, 'length') } value={value.length} picked={picked} onPick={onPick} full={full} title={t('widgets.customapi.pickCount', { path: stepOf(path, 'length') ?? '' })} />}
          {listable && <button type="button" className="nd-btn nd-btn-compact ndw-api-use-list" onClick={() => onList!(path)}><Table2 size={12} />{t('widgets.customapi.useList')}</button>}
        </div>
        {open && (
          <div className="ndw-api-children">
            {entries.slice(0, 50).map(([key, child]) => {
              const next = stepOf(path, key);
              return next === null
                ? <div key={String(key)} className="ndw-api-leaf is-blocked" title={t('widgets.customapi.unreachable')}><span className="ndw-api-key">{String(key)}</span></div>
                : <JsonNode key={String(key)} value={child} path={next} name={key} depth={depth + 1} picked={picked} onPick={onPick} onList={onList} full={full} />;
            })}
          </div>
        )}
      </div>
    );
  }
  const preview = value === null ? 'null' : typeof value === 'string' ? `"${value.length > 40 ? `${value.slice(0, 40)}…` : value}"` : String(value);
  return (
    <div className="ndw-api-leaf">
      <span className="ndw-api-key">{label}</span>
      <span className={`ndw-api-preview is-${value === null ? 'null' : typeof value}`}>{preview}</span>
      <PickButton path={path} value={value} picked={picked} onPick={onPick} full={full} title={t('widgets.customapi.pick', { path })} />
    </div>
  );
}

function PickButton({ path, value, picked, onPick, full, title }: { path: string | null; value: unknown; picked: Set<string>; onPick: (path: string, value: unknown) => void; full: boolean; title: string }) {
  if (!path) return null;
  const chosen = picked.has(path);
  return (
    <button type="button" className={`ndw-api-pick ${chosen ? 'is-picked' : ''}`} disabled={chosen || full} onClick={() => onPick(path, value)} aria-label={title} title={title}>
      <Plus size={12} />
    </button>
  );
}

/** A picked value: its label, format and unit; thresholds and scale behind the slider button. */
function FieldRow({ field, display, first, last, onChange, onMove, onRemove }: {
  field: CustomApiField; display: string; first: boolean; last: boolean;
  onChange: (field: CustomApiField) => void; onMove: (step: -1 | 1) => void; onRemove: () => void;
}) {
  const { t } = useI18n();
  const [more, setMore] = useState(false);
  const set = (patch: Partial<CustomApiField>) => onChange({ ...field, ...patch });
  const number = (value: string) => (value.trim() === '' || !Number.isFinite(Number(value)) ? undefined : Number(value));
  return (
    <li className="ndw-api-field">
      <div className="ndw-api-field-main">
        <input className="nd-input" value={field.label} maxLength={60} onChange={event => set({ label: event.target.value })} aria-label={t('widgets.customapi.label')} />
        <CustomSelect ariaLabel={t('widgets.customapi.format')} value={field.format ?? 'auto'} onChange={value => set({ format: value as CustomApiFormat })} options={FORMATS.map(value => ({ value, label: t(`widgets.customapi.format.${value}`) }))} />
        <input className="nd-input ndw-api-unit-input" value={field.unit ?? ''} maxLength={12} placeholder={t('widgets.customapi.unit')} onChange={event => set({ unit: event.target.value || undefined })} aria-label={t('widgets.customapi.unit')} />
        <span className="ndw-api-field-tools">
          <button type="button" className={`ndc-icon-button ${more ? 'is-active' : ''}`} onClick={() => setMore(!more)} aria-expanded={more} aria-label={t('widgets.customapi.more')} title={t('widgets.customapi.more')}><SlidersHorizontal size={13} /></button>
          <button type="button" className="ndc-icon-button" disabled={first} onClick={() => onMove(-1)} aria-label={t('widgets.list.moveUp', { name: field.label })}><ArrowUp size={13} /></button>
          <button type="button" className="ndc-icon-button" disabled={last} onClick={() => onMove(1)} aria-label={t('widgets.list.moveDown', { name: field.label })}><ArrowDown size={13} /></button>
          <button type="button" className="ndc-icon-button is-danger" onClick={onRemove} aria-label={t('widgets.list.remove', { name: field.label })}><X size={13} /></button>
        </span>
      </div>
      <span className="ndw-api-field-path">{field.path}</span>
      {more && (
        <div className="ndw-api-field-more">
          <label><span>{t('widgets.customapi.decimals')}</span><input className="nd-input" inputMode="numeric" value={field.decimals ?? ''} onChange={event => { const value = number(event.target.value); set({ decimals: value === undefined ? undefined : Math.min(6, Math.max(0, Math.round(value))) }); }} /></label>
          {display === 'gauges' && <label><span>{t('widgets.customapi.min')}</span><input className="nd-input" inputMode="decimal" value={field.min ?? ''} placeholder="0" onChange={event => set({ min: number(event.target.value) })} /></label>}
          {display === 'gauges' && <label><span>{t('widgets.customapi.max')}</span><input className="nd-input" inputMode="decimal" value={field.max ?? ''} placeholder="100" onChange={event => set({ max: number(event.target.value) })} /></label>}
          <label><span>{t('widgets.customapi.warn')}</span><input className="nd-input" inputMode="decimal" value={field.warn ?? ''} onChange={event => set({ warn: number(event.target.value) })} /></label>
          <label><span>{t('widgets.customapi.crit')}</span><input className="nd-input" inputMode="decimal" value={field.crit ?? ''} onChange={event => set({ crit: number(event.target.value) })} /></label>
          <CalmeRow label={t('widgets.customapi.lowIsBad')}>
            <CalmeSwitch label={t('widgets.customapi.lowIsBad')} checked={field.lowIsBad === true} onChange={on => set({ lowIsBad: on || undefined })} />
          </CalmeRow>
        </div>
      )}
    </li>
  );
}
