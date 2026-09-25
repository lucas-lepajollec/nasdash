import React from 'react';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { useCalme } from '@/widgets/calme';
import { CalmeHeading, CalmeRow, CalmeSegmented, CalmeSwitch } from '../../shared/CalmeControls';
import { useI18n } from '@/i18n/I18nProvider';

/** This widget has no shared option: it is placed and removed from pages. */
export function DockerActionsWidgetTab() {
  const { t } = useI18n();
  const calme = useCalme();
  if (calme) return <div className="ndc-set-page"><WidgetPlacementNote type="dockeractions" /><p className="ndc-set-empty">{t('settings.calme.noOptions')}</p></div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WidgetPlacementNote type="dockeractions" />
    </div>
  );
}
