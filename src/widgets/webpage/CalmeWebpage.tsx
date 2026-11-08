'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { bounded, WidgetSettingsButton } from '@/components/widgets/content/kit';
import { CalmeWidget } from '../calme';

export const WEBPAGE_HEIGHT = { min: 160, max: 4000, step: 20, default: 480 } as const;
/** How long a page left on screen stays loaded (its session and connections kept) before it is unloaded. */
export const WEBPAGE_KEEP_MS = 5 * 60_000;

/**
 * Whether the frame should exist: not before the widget is first shown, kept
 * while it is hidden for `keepMs` (back to it without a reload), then dropped
 * so a page on another tab of the dashboard stops using the machine.
 */
export function useKeptAlive(visible: boolean, keepMs = WEBPAGE_KEEP_MS): boolean {
  const [alive, setAlive] = useState(visible);
  if (visible && !alive) setAlive(true);
  useEffect(() => {
    if (visible || !alive) return;
    const timer = window.setTimeout(() => setAlive(false), keepMs);
    return () => window.clearTimeout(timer);
  }, [visible, alive, keepMs]);
  return alive;
}

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
 * the page; many sites forbid being shown in a frame and stay blank. It is
 * loaded once on screen, kept a few minutes when its page is left, then
 * unloaded.
 */
export default function CalmeWebpage({ settings, editMode, isVisible, onUpdateSettings }: { settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const url = typeof settings.url === 'string' ? settings.url.trim() : '';
  const problem = webpageProblem(url, origin);
  const height = bounded(settings.height, WEBPAGE_HEIGHT.min, WEBPAGE_HEIGHT.max, WEBPAGE_HEIGHT.default);
  const alive = useKeptAlive(isVisible);
  const title = t('widget.webpage.name');
  const open = !problem ? <a className="ndc-icon-button" href={url} target="_blank" rel="noreferrer noopener" aria-label={t('widgets.webpage.open')} title={t('widgets.webpage.open')} data-no-widget-drag><ExternalLink size={12} /></a> : undefined;
  return (
    <CalmeWidget title={title} editMode={editMode} flush={!problem} hideTitle={settings.title === false} aside={open}>
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
                <CalmeRow label={t('widgets.webpage.height')} stacked>
                  <CalmeSlider label={t('widgets.webpage.height')} min={WEBPAGE_HEIGHT.min} max={WEBPAGE_HEIGHT.max} step={WEBPAGE_HEIGHT.step}
                    value={bounded(draft.height, WEBPAGE_HEIGHT.min, WEBPAGE_HEIGHT.max, WEBPAGE_HEIGHT.default)}
                    onChange={value => change({ height: value })} onCommit={value => change({ height: value === WEBPAGE_HEIGHT.default ? null : value })} format={value => `${value} px`} />
                </CalmeRow>
                <CalmeRow label={t('widgets.webpage.showTitle')}>
                  <CalmeSwitch label={t('widgets.webpage.showTitle')} checked={draft.title !== false} onChange={on => change({ title: on ? null : false })} />
                </CalmeRow>
              </>
            );
          }}
        </WidgetSettingsButton>
      )}
      {problem
        ? <p className="ndw-media-sub is-quiet ndw-webpage-note">{t(`widgets.webpage.problem.${problem}`)}</p>
        : (
          <div className={`ndw-webpage-frame ${editMode ? 'is-editing' : ''}`} style={{ height }}>
            {alive && <iframe
              className="ndw-webpage"
              src={url}
              title={title}
              loading="lazy"
              referrerPolicy="no-referrer"
              // Scripts and forms work; the page cannot navigate NasDash, open dialogs or reach downloads.
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              // In edit mode the frame must not catch the pointer: the widget can be dragged across it.
              // Only what a page shown in a dashboard needs: no camera, microphone, location, payment or USB.
              allow="fullscreen; clipboard-write"
              {...(editMode ? { 'aria-hidden': true, tabIndex: -1 } : {})}
            />}
          </div>
        )}
    </CalmeWidget>
  );
}
