'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented } from '@/components/modals/settings/shared/CalmeControls';
import { bounded, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { CalmeWidget } from '../calme';

export const WEBPAGE_HEIGHTS = [240, 360, 480, 640, 800] as const;

/**
 * Why an address cannot be shown, or none: only http(s) pages of another
 * origin than NasDash (a NasDash page inside itself would run with its rights).
 */
export function webpageProblem(value: unknown, origin: string): 'missing' | 'invalid' | 'self' | 'insecure' | null {
  if (typeof value !== 'string' || !value.trim()) return 'missing';
  let url: URL;
  try { url = new URL(value.trim()); } catch { return 'invalid'; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'invalid';
  if (url.username || url.password) return 'invalid';
  if (url.origin === origin) return 'self';
  // A browser blocks an http page inside an https dashboard.
  if (origin.startsWith('https:') && url.protocol === 'http:') return 'insecure';
  return null;
}

/**
 * A web page inside the dashboard (a service's status page, a camera's
 * snapshot, a small tool). It runs sandboxed: it cannot open NasDash or move
 * the page; many sites forbid being shown in a frame and stay blank.
 */
export default function CalmeWebpage({ settings, editMode, onUpdateSettings }: { settings: WidgetSettings; editMode: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const url = typeof settings.url === 'string' ? settings.url.trim() : '';
  const problem = webpageProblem(url, origin);
  const height = bounded(settings.height, 160, 1200, 360);
  const title = t('widget.webpage.name');
  return (
    <CalmeWidget title={title} editMode={editMode} flush={!problem}
      aside={!problem ? <a className="ndc-icon-button" href={url} target="_blank" rel="noreferrer noopener" aria-label={t('widgets.webpage.open')} title={t('widgets.webpage.open')} data-no-widget-drag><ExternalLink size={12} /></a> : undefined}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings}>
          {(draft, change) => {
            const draftProblem = webpageProblem(draft.url, origin);
            return (
              <>
                <CalmeField label={t('widgets.webpage.url')} info={t('widgets.webpage.urlHint')}>
                  <input className="nd-input" type="url" inputMode="url" value={typeof draft.url === 'string' ? draft.url : ''} maxLength={2000} placeholder="https://status.example.com" onChange={event => change({ url: event.target.value || null })} />
                  {draftProblem && draftProblem !== 'missing' && <p className="ndw-media-sub ndw-webpage-warning" role="status">{t(`widgets.webpage.problem.${draftProblem}`)}</p>}
                </CalmeField>
                <CalmeRow label={t('widgets.webpage.height')}>
                  <CalmeSegmented label={t('widgets.webpage.height')} value={String(bounded(draft.height, 160, 1200, 360))} options={WEBPAGE_HEIGHTS.map(value => ({ value: String(value), label: `${value}` }))} onChange={value => change({ height: Number(value) === 360 ? null : Number(value) })} />
                </CalmeRow>
              </>
            );
          }}
        </WidgetSettingsButton>
      )}
      {problem
        ? <p className="ndw-media-sub is-quiet ndw-webpage-note">{t(`widgets.webpage.problem.${problem}`)}</p>
        : (
          <iframe
            className="ndw-webpage"
            src={url}
            title={title}
            style={{ height, ...(editMode ? { pointerEvents: 'none' as const } : {}) }}
            loading="lazy"
            referrerPolicy="no-referrer"
            // Scripts and forms work; the page cannot navigate NasDash, open dialogs or reach downloads.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            // In edit mode the frame must not catch the pointer: the widget can be dragged across it.
            {...(editMode ? { 'aria-hidden': true, tabIndex: -1 } : {})}
          />
        )}
    </CalmeWidget>
  );
}
