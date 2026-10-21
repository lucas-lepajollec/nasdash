'use client';

import React from 'react';
import { CircleCheck, CircleX, ExternalLink } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { CUSTOM_API_TYPES, type CustomApiDisplay, type CustomApiField, type CustomApiResponse, type CustomApiValue } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { useAuth } from '@/providers/AuthProvider';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { RingGauge } from '@/components/charts/Gauges';
import { CalmeWidget } from '../calme';
import { DataError, pick, useRelativeTime, useWidgetData, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { chosenConnection } from '@/components/widgets/content/ConnectionPicker';
import { formatValue, shareOf, toneOf, type Tone } from './format';
import { CustomApiSettings } from './CustomApiSettings';

export const DISPLAYS: readonly CustomApiDisplay[] = ['figures', 'gauges', 'list', 'table', 'status'];
export const REFRESHES = ['15', '30', '60', '300', '900'] as const;

/** The widget's fields, as saved (bad entries left out). */
export function fieldsOf(settings: WidgetSettings): CustomApiField[] {
  return Array.isArray(settings.fields)
    ? (settings.fields as unknown[]).filter((field): field is CustomApiField => !!field && typeof field === 'object' && typeof (field as CustomApiField).path === 'string' && typeof (field as CustomApiField).id === 'string').slice(0, 12)
    : [];
}

const TONE_COLOR: Record<NonNullable<Tone>, string> = { ok: 'var(--nd-green)', warn: 'var(--nd-yellow)', crit: 'var(--nd-red)' };

/**
 * Any JSON API, read by the server from a connection saved in Settings →
 * Integrations → Custom APIs: the values picked in the widget's settings,
 * shown as figures, gauges, a list, a table or a single status. Only those
 * values reach the browser, never the whole answer, the address or the key.
 */
export default function CalmeCustomApi({ widgetId, settings, editMode, isVisible, onUpdateSettings }: {
  widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { user } = useAuth();
  const connection = chosenConnection(config?.integrations, CUSTOM_API_TYPES, settings.integrationId);
  const display = pick(settings.display, DISPLAYS, 'figures');
  const fields = fieldsOf(settings);
  const refresh = Number(pick(String(settings.refresh), REFRESHES, '60'));
  const ready = display === 'status' ? typeof settings.okPath === 'string' && settings.okPath !== '' : fields.length > 0 && (display !== 'table' || typeof settings.listPath === 'string');
  const { data, error, mutate, isValidating, stale } = useWidgetData<CustomApiResponse>('/api/widgets/customapi', widgetId, settings, {
    refreshMs: refresh * 1000, isVisible, method: 'GET', enabled: !!connection && ready,
  });
  const title = typeof settings.title === 'string' && settings.title.trim() ? settings.title.trim() : t('widget.customapi.name');

  return (
    <CalmeWidget title={title} editMode={editMode} aside={isValidating && data ? <span className="nd-spinner" style={{ width: 10, height: 10 }} /> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings} width={860} shared={{ tab: 'widget-customapi', label: t('widgets.customapi.manage') }}>
          {(draft, change) => <CustomApiSettings draft={draft} change={change} />}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-api-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? (settings.integrationId ? <div className="ndc-empty ndc-empty--error">{t('widgets.dns.connectionGone')}</div> : <SetupGuide kind="customapi" />)
          : !ready ? <div className="ndc-empty">{t(user?.role === 'admin' ? 'widgets.customapi.pickHint' : 'widgets.customapi.notReady')}</div>
            : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
              : !data ? <div className="ndw-skeleton" aria-hidden="true"><span className="ndw-skeleton-row" style={{ height: 44 }} /><span className="ndw-skeleton-row" /></div>
                : <CustomApiBody data={data} display={display} fields={fields} settings={settings} />}
      </div>
    </CalmeWidget>
  );
}

function useFormat() {
  const { locale } = useI18n();
  const relative = useRelativeTime();
  return (field: CustomApiField, value: CustomApiValue) => formatValue(field, value, locale, time => relative(time));
}

export function CustomApiBody({ data, display, fields, settings }: { data: CustomApiResponse; display: CustomApiDisplay; fields: CustomApiField[]; settings: WidgetSettings }) {
  const { t } = useI18n();
  const format = useFormat();

  if (display === 'status') {
    const ok = data.status?.ok === true;
    const label = typeof settings.statusLabel === 'string' && settings.statusLabel.trim() ? settings.statusLabel.trim() : undefined;
    return (
      <div className={`ndw-api-status ${ok ? 'is-ok' : 'is-down'}`} role="status">
        <span className="ndw-api-status-mark" aria-hidden="true">{ok ? <CircleCheck size={22} /> : <CircleX size={22} />}</span>
        <span className="ndw-api-status-text">
          <span className="ndw-api-status-word">{t(ok ? 'widgets.customapi.statusOk' : 'widgets.customapi.statusDown')}</span>
          {(label || data.status?.value !== undefined) && <span className="ndw-api-status-detail">{[label, data.status?.value === null || data.status?.value === undefined ? undefined : String(data.status.value)].filter(Boolean).join(' · ')}</span>}
        </span>
        {fields.length > 0 && (
          <span className="ndw-api-status-values">
            {fields.map((field, index) => <Value key={field.id} field={field} value={data.values[index]} format={format} compact />)}
          </span>
        )}
      </div>
    );
  }

  if (display === 'table') {
    const rows = data.rows ?? [];
    if (!rows.length) return <div className="ndc-empty">{t('widgets.customapi.noRows')}</div>;
    return (
      <div className="ndw-api-table-wrap">
        <table className="ndw-api-table">
          <thead><tr>{fields.map(field => <th key={field.id} scope="col">{field.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{fields.map((field, index) => <td key={field.id}><Value field={field} value={row[index]} format={format} compact /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (display === 'gauges') {
    return (
      <div className="ndw-api-gauges">
        {fields.map((field, index) => {
          const value = data.values[index];
          const tone = toneOf(field, value);
          const shown = format(field, value);
          return (
            <div key={field.id} className="ndw-api-gauge">
              {/* The ring names its value inside. */}
              <RingGauge percent={shareOf(field, value)} color={tone ? TONE_COLOR[tone] : 'var(--nd-accent)'} label={field.label} size={92} text={shown.text} unit={shown.unit} />
            </div>
          );
        })}
      </div>
    );
  }

  if (display === 'list') {
    return (
      <ul className="ndw-api-list">
        {fields.map((field, index) => (
          <li key={field.id}>
            <span className="ndw-api-label">{field.label}</span>
            <Value field={field} value={data.values[index]} format={format} compact />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="ndw-api-figures">
      {fields.map((field, index) => (
        <div key={field.id} className="ndw-api-figure">
          <Value field={field} value={data.values[index]} format={format} />
          <span className="ndw-api-label">{field.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A formatted value, its unit set smaller, coloured by its thresholds. */
/** A web address in the answer: a short, clickable label instead of the whole URL. */
function linkOf(value: CustomApiValue): { href: string; label: string } | undefined {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return undefined;
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/$/, '');
    return { href: url.href, label: `${url.hostname.replace(/^www\./, '')}${path.length > 24 ? `${path.slice(0, 24)}…` : path}` };
  } catch { return undefined; }
}

/** A formatted value, its unit set smaller, coloured by its thresholds; long text and addresses never overflow. */
function Value({ field, value, format, compact }: { field: CustomApiField; value: CustomApiValue; format: ReturnType<typeof useFormat>; compact?: boolean }) {
  const shown = format(field, value);
  const tone = toneOf(field, value);
  const link = linkOf(value);
  // Words (not numbers) are set smaller and may wrap on two lines.
  const text = !link && typeof value === 'string' && !/^-?[\d.,]+$/.test(shown.text) && shown.text.length > 10;
  const className = `ndw-api-value ${compact ? 'is-compact' : ''} ${text ? 'is-text' : ''} ${link ? 'is-link' : ''} ${tone ? `is-${tone}` : ''}`;
  if (link) {
    return <a className={className} href={link.href} target="_blank" rel="noopener noreferrer" title={link.href}><span className="ndw-api-link-text">{link.label}</span><ExternalLink size={11} aria-hidden="true" /></a>;
  }
  return (
    <span className={className} title={value === null ? undefined : String(value)}>
      {shown.text}{shown.unit && <span className="ndw-api-unit">{shown.unit}</span>}
    </span>
  );
}
