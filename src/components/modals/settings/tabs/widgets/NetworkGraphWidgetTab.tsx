import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeRow, CalmeSwitch } from '../../shared/CalmeControls';

/** Shared options of the latency graph, wherever it is placed. */
export function NetworkGraphWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="networkgraph" />
      <section className="ndc-set-block">
        <CalmeHeading>{t('settings.calme.display')}</CalmeHeading>
        <CalmeRow label={t('network.calme.advanced')} info={t('network.calme.advancedHint')}>
          <CalmeSwitch label={t('network.calme.advanced')} checked={!!config?.settings?.networkGraphStats} onChange={value => updateConfig({ networkGraphStats: value })} />
        </CalmeRow>
      </section>
    </div>
  );
}
