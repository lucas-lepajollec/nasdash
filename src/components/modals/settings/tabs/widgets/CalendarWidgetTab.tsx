import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { useCalme } from '@/widgets/calme';
import { CalmeHeading, CalmeRow, CalmeSegmented, CalmeSwitch } from '../../shared/CalmeControls';

export function CalendarWidgetTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const demoMode = config?.demoMode === true;
  const [calendarUrl, setCalendarUrl] = useState(config?.settings?.calendarUrl || '');

  const calme = useCalme();
  if (calme) {
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WidgetPlacementNote type="calendar" />

      {/* Calendar Sync URL */}
      {demoMode ? (
        <div className="nd-settings-card" style={{ padding: '14px', background: 'color-mix(in srgb, var(--nd-accent) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--nd-accent) 28%, var(--nd-card-border))', borderRadius: 'var(--nd-card-radius)' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>{t("Synchronisation iCal simulée")}</h4>
          <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.55 }}>
            {t("Les événements affichés sont fictifs. La démo n’accepte ni ne télécharge d’URL de calendrier réelle afin de protéger vos données privées.")}
          </p>
        </div>
      ) : (
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>{t("Synchronisation iCal")}</h4>
        <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
          {t("Collez l&apos;URL d&apos;un calendrier au format .ics (Google Agenda, Apple, etc.) pour afficher vos événements.")}
        </p>
        <input
          type="url"
          aria-label={t("URL du calendrier iCal")}
          className="nd-input"
          placeholder="https://..."
          value={calendarUrl}
          onChange={(e) => {
            setCalendarUrl(e.target.value);
          }}
          onBlur={() => {
            updateConfig({ calendarUrl });
          }}
          style={{ width: '100%', fontSize: '0.75rem', padding: '10px 14px' }}
        />
      </div>
      )}
    </div>
  );
}
