import React from 'react';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { useI18n } from '@/i18n/I18nProvider';

/** This widget has no shared option: it is placed and removed from pages. */
export function DockerActionsWidgetTab() {
  const { t } = useI18n();
  return <div className="ndc-set-page"><WidgetPlacementNote type="dockeractions" /><p className="ndc-set-empty">{t('settings.calme.noOptions')}</p></div>;
}
