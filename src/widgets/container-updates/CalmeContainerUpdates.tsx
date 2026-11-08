'use client';

import React from 'react';
import { ArrowRight, CircleCheck, PackageOpen } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { ContainerUpdatesSummary } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeRow, CalmeSegmented } from '@/components/modals/settings/shared/CalmeControls';
import { KitWidget } from '@/components/widgets/content/KitWidget';
import { bounded } from '@/components/widgets/content/kit';

const ROWS = [3, 5, 8, 12, 20] as const;

/**
 * Container updates (What's Up Docker): which containers have a newer image,
 * from the current tag to the new one, the biggest jumps first, with the
 * release notes when the registry gives them. Read only: updating stays the
 * administrator's choice, in their own tools.
 */
export default function CalmeContainerUpdates(props: { widgetId: string; settings: WidgetSettings; editMode: boolean; isVisible: boolean; onUpdateSettings: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const rows = bounded(props.settings.rows, 3, 20, 5);
  return (
    <KitWidget<ContainerUpdatesSummary> widget="container-updates" refreshMs={5 * 60_000} skeleton={[22, 28, 28, 28]} {...props}
      extraSettings={(draft, change) => (
        <CalmeRow label={t('widgets.updates.rows')}>
          <CalmeSegmented label={t('widgets.updates.rows')} value={String(bounded(draft.rows, 3, 20, 5))} options={ROWS.map(count => ({ value: String(count), label: String(count) }))} onChange={value => change({ rows: Number(value) === 5 ? null : Number(value) })} />
        </CalmeRow>
      )}>
      {data => <Updates data={data} rows={rows} />}
    </KitWidget>
  );
}

function Updates({ data, rows }: { data: ContainerUpdatesSummary; rows: number }) {
  const { t } = useI18n();
  const count = data.updates.length;
  const hidden = Math.max(0, count - rows);
  return (
    <div className="ndw-kit">
      <span className={`ndw-kit-state ${count ? 'is-pending' : ''}`}>
        {count ? <PackageOpen size={13} aria-hidden="true" /> : <CircleCheck size={13} aria-hidden="true" />}
        <span className="ndw-kit-name">{count ? t('widgets.updates.available', { count }) : t('widgets.updates.none')}</span>
        <span className="ndw-kit-word">{t('widgets.updates.watched', { count: data.total })}</span>
      </span>
      {count > 0 && (
        <ul className="ndw-kit-list">
          {data.updates.slice(0, rows).map(update => {
            const versions = (
              <span className="ndw-kit-versions">
                <span>{update.current}</span>
                {update.latest && update.latest !== update.current && <><ArrowRight size={10} aria-hidden="true" /><span>{update.latest}</span></>}
                {update.kind === 'digest' && <span className="ndw-kit-tag">{t('widgets.updates.rebuilt')}</span>}
              </span>
            );
            return (
              <li key={`${update.name}:${update.image}`} className="ndw-kit-row">
                <span className="ndw-kit-row-head">
                  {update.link
                    ? <a className="ndw-kit-row-name" href={update.link} target="_blank" rel="noreferrer noopener" title={t('widgets.updates.notes', { name: update.name })}>{update.name}</a>
                    : <span className="ndw-kit-row-name" title={update.image}>{update.name}</span>}
                  {update.level && <span className={`ndw-kit-level is-${update.level}`}>{t(`widgets.updates.level.${update.level}`)}</span>}
                </span>
                {versions}
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 && <span className="ndw-media-sub">{t('widgets.updates.more', { count: hidden })}</span>}
      {data.errors > 0 && <span className="ndw-media-sub is-quiet">{t('widgets.updates.errors', { count: data.errors })}</span>}
    </div>
  );
}
