import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';
import { WidgetDockerLayoutConfig } from '../../shared/WidgetDockerLayoutConfig';
import { WidgetNetworksLayoutConfig } from '../../shared/WidgetNetworksLayoutConfig';

export function CalendarWidgetTab() {
  const { config, updateConfig } = useConfig();

  const hideCalendar = !!config?.settings?.hideCalendar;
  const [calendarUrl, setCalendarUrl] = useState(config?.settings?.calendarUrl || '');

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={!hideCalendar}
          onChange={(val) => handleToggleWidget('hideCalendar', !val)}
          label="Activer le widget Calendrier"
          sublabel="Affiche un calendrier simple sur votre tableau de bord."
        />
      </div>

      {!hideCalendar && (
        <>
          <WidgetLayoutConfig widgetId="calendar" />
          <WidgetDockerLayoutConfig widgetId="calendar" />
          <WidgetNetworksLayoutConfig widgetId="calendar" />

          {/* Calendar Sync URL */}
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Synchronisation iCal</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
              Collez l&apos;URL d&apos;un calendrier au format .ics (Google Agenda, Apple, etc.) pour afficher vos événements.
            </p>
            <input
              type="url"
              aria-label="URL du calendrier iCal"
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
        </>
      )}
    </div>
  );
}
