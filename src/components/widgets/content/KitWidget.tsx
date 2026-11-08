'use client';

import React, { useEffect, useState } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { KitSummaryBase } from '@/lib/widgetData/contracts';
import { kitFamilyOfWidget } from '@/integrations/kit';
import { demoFetch } from '@/lib/demoTransport';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { SetupGuide, type SetupKind } from '@/components/integrations/SetupGuide';
import type { IntegrationSection } from '@/components/modals/settings/tabs/IntegrationsTab';
import { CalmeWidget } from '@/widgets/calme';
import { DataError, useWidgetData, WidgetDataError, WidgetSettingsButton } from './kit';
import { chosenConnection, ConnectionPicker } from './ConnectionPicker';

export interface KitTools {
  /** Runs one of the integration's actions (`kitServer.ts`); the answer replaces the shown data. */
  run: (action: string, target?: string) => Promise<void>;
  /** The action in progress (`action` or `action:target`), if any. */
  busy: string | null;
}

/**
 * The shell every kit widget shares (`src/integrations/kit.ts`): the widget's
 * connection in its settings, the setup guide until one is saved, loading,
 * errors and actions. The widget itself only draws its data.
 */
export function KitWidget<T extends KitSummaryBase>({ widget, widgetId, settings, editMode, isVisible, onUpdateSettings, refreshMs, skeleton = [40, 36], extraSettings, children }: {
  widget: string;
  widgetId: string;
  settings: WidgetSettings;
  editMode: boolean;
  isVisible: boolean;
  onUpdateSettings: (settings: WidgetSettings) => void;
  /** How often the widget asks again while it is on screen (the server shares one reading for its `ttlMs`); may depend on the data (faster while an action runs). */
  refreshMs: number | ((data: T | undefined) => number);
  /** Heights (px) of the placeholder rows while the first answer comes. */
  skeleton?: number[];
  /** The widget's own settings, under the connection; `data` is the last answer, when there is one (folder names…). */
  extraSettings?: (draft: WidgetSettings, change: (patch: WidgetSettings) => void, data: T | undefined) => React.ReactNode;
  children: (data: T, tools: KitTools) => React.ReactNode;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const family = kitFamilyOfWidget(widget)!;
  const connection = chosenConnection(config?.integrations, family.types, settings.integrationId);
  const { data, error, mutate, stale } = useWidgetData<T>('/api/widgets/kit', widgetId, settings, { refreshMs, isVisible, method: 'GET', params: { widget }, enabled: !!connection });
  const [busy, setBusy] = useState<string | null>(null);
  // A pace that depends on the data (an update running) is followed answer by answer: the interval SWR already
  // planned would otherwise keep its old pace until it fires.
  useEffect(() => {
    if (typeof refreshMs !== 'function' || !data || !isVisible) return;
    const timer = window.setTimeout(() => void mutate(), refreshMs(data));
    return () => window.clearTimeout(timer);
  }, [data, isVisible, mutate, refreshMs]);
  const [failed, setFailed] = useState<string | null>(null);
  const title = t(`widget.${widget}.name`);

  const run = async (action: string, target?: string) => {
    setBusy(target ? `${action}:${target}` : action); setFailed(null);
    try {
      const response = await demoFetch('/api/widgets/kit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ widget, widgetId, action, ...(target ? { target } : {}) }) });
      const answer = await response.json().catch(() => null) as (T & { error?: string }) | null;
      if (!response.ok || !answer) throw new WidgetDataError(answer?.error || 'widgets.error.network', response.status);
      void mutate(answer, { revalidate: false });
    } catch (cause) { setFailed(cause instanceof WidgetDataError ? cause.key : 'widgets.error.network'); }
    finally { setBusy(null); }
  };

  return (
    <CalmeWidget title={title} editMode={editMode}>
      {editMode && (
        <WidgetSettingsButton title={t('widgets.settingsOf', { name: title })} settings={settings} onSave={onUpdateSettings}>
          {(draft, change) => (
            <>
              <CalmeField label={t('widgets.connection')}>
                <ConnectionPicker types={family.types} section={family.section as IntegrationSection} value={typeof draft.integrationId === 'string' ? draft.integrationId : undefined} onChange={id => change({ integrationId: id })} />
              </CalmeField>
              {extraSettings?.(draft, change, data)}
            </>
          )}
        </WidgetSettingsButton>
      )}
      <div className={`ndw-media-box ${stale ? 'is-stale' : ''}`}>
        {!connection ? <SetupGuide kind={family.section as SetupKind} />
          : error && !data ? <DataError error={error} onRetry={() => void mutate()} />
            : !data ? <div className="ndw-skeleton" aria-hidden="true">{skeleton.map((height, index) => <span key={index} className="ndw-skeleton-row" style={{ height }} />)}</div>
              : children(data, { run, busy })}
        {failed && <p className="ndw-note ndw-down" role="alert">{t(failed)}</p>}
      </div>
    </CalmeWidget>
  );
}
