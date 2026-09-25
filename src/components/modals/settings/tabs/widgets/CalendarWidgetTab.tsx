import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading } from '../../shared/CalmeControls';

export function CalendarWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const demoMode = config?.demoMode === true;
  const [calendarUrl, setCalendarUrl] = useState(config?.settings?.calendarUrl || '');

  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="calendar" />
      <section className="ndc-set-block">
        <CalmeHeading info={demoMode
          ? t("Les événements affichés sont fictifs. La démo n’accepte ni ne télécharge d’URL de calendrier réelle afin de protéger vos données privées.")
          : t("Collez l&apos;URL d&apos;un calendrier au format .ics (Google Agenda, Apple, etc.) pour afficher vos événements.")}>
          {t("Synchronisation iCal")}
        </CalmeHeading>
        {!demoMode && (
          <input
            type="url"
            aria-label={t("URL du calendrier iCal")}
            className="nd-input"
            placeholder="https://…/calendar.ics"
            value={calendarUrl}
            onChange={(e) => setCalendarUrl(e.target.value)}
            onBlur={() => updateConfig({ calendarUrl })}
          />
        )}
      </section>
    </div>
  );
}
