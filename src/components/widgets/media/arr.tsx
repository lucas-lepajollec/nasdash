'use client';

import React, { useMemo } from 'react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { IntegrationInstance } from '@/lib/types';
import type { SourceFailure } from '@/lib/widgetData/contracts';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { SetupGuide, type SetupKind } from '@/components/integrations/SetupGuide';
import { SourceChoice } from '@/components/widgets/content/kit';
import { connectionDetail } from '@/components/widgets/content/ConnectionPicker';

/** Saved connections of these types, in the order they were added. */
export function useConnections(types: readonly string[]): IntegrationInstance[] {
  const { config } = useConfig();
  return useMemo(() => (config?.integrations ?? []).filter(instance => types.includes(instance.type)), [config?.integrations, types]);
}

/** The connections a multi-source widget reads: its choice (`integrationIds`), else all of them. */
export function chosenSources(connections: IntegrationInstance[], settings: WidgetSettings): IntegrationInstance[] {
  return Array.isArray(settings.integrationIds) ? connections.filter(instance => (settings.integrationIds as unknown[]).includes(instance.id)) : connections;
}

/** Which connections a widget reads: all (new ones join by themselves) or a selection. */
export function SourcesField({ connections, draft, change }: { connections: IntegrationInstance[]; draft: WidgetSettings; change: (patch: WidgetSettings) => void }) {
  const { t } = useI18n();
  if (connections.length < 2) return null;
  return (
    <CalmeField label={t('widgets.arr.sources')}>
      <SourceChoice
        label={t('widgets.arr.sources')}
        items={connections.map(instance => ({ id: instance.id, name: instance.name, detail: connectionDetail(instance) }))}
        value={draft.integrationIds}
        onChange={ids => change({ integrationIds: ids })}
      />
    </CalmeField>
  );
}

/** The widget before any connection of its kind exists. */
export function ArrSetup({ kind }: { kind: SetupKind }) {
  return <SetupGuide kind={kind} />;
}

/** "1 source unreachable", the names in the tooltip; nothing when all answered. */
export function FailuresNote({ failures }: { failures: SourceFailure[] | undefined }) {
  const { t } = useI18n();
  if (!failures?.length) return null;
  return <span className="ndc-title-note ndw-down" title={failures.map(failure => `${failure.name} · ${t(failure.error)}`).join('\n')}>{t('widgets.arr.failures', { count: failures.length })}</span>;
}

/** Sizes and speeds, short, in the interface language. */
export function useByteFormat() {
  const { locale } = useI18n();
  return useMemo(() => {
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const scaled = (value: number, units: string[]) => {
      let index = 0, current = Math.max(0, value);
      while (current >= 1000 && index < units.length - 1) { current /= 1024; index++; }
      return { value: number.format(current >= 100 ? Math.round(current) : current), unit: units[index] };
    };
    return {
      size: (bytes: number) => { const part = scaled(bytes, ['B', 'KB', 'MB', 'GB', 'TB']); return `${part.value} ${part.unit}`; },
      speed: (bps: number) => scaled(bps, ['B/s', 'KB/s', 'MB/s', 'GB/s']),
    };
  }, [locale]);
}

/** "2 h 05", "12 min", "3 d" — a remaining time, short. */
export function useEta() {
  const { t } = useI18n();
  return (ms: number | undefined) => {
    if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return '';
    const minutes = Math.round(ms / 60_000);
    if (minutes < 1) return t('widgets.arr.eta.soon');
    if (minutes < 60) return t('widgets.arr.eta.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return t('widgets.arr.eta.hours', { hours, minutes: String(minutes % 60).padStart(2, '0') });
    return t('widgets.arr.eta.days', { count: Math.round(hours / 24) });
  };
}
