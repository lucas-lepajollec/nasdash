'use client';

import React, { useEffect, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeWidget } from '../calme';

/**
 * Calme clock: a large, light time with the seconds kept small, the date on
 * one line. The clock styles of
 * Settings still apply: "minimal" keeps the time alone, "split" stacks the
 * hours over the minutes, "glow" puts the time in the accent colour.
 */
export default function CalmeClock({ editMode, isVisible = true }: { editMode?: boolean; isVisible?: boolean }) {
  const { t, locale } = useI18n();
  const { config } = useConfig();
  const [now, setNow] = useState<Date | null>(null);
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZone = config?.settings?.clockTimezone || localZone;
  const design = config?.settings?.clockDesign || 'default';

  // Ticks only while its page is shown.
  useEffect(() => {
    if (!isVisible) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isVisible]);
  if (!now) return null;

  const format = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone }).formatToParts(now);
    } catch {
      return new Intl.DateTimeFormat(locale, options).formatToParts(now);
    }
  };
  const part = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  const timeParts = format({ hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const hour = part(timeParts, 'hour');
  const minute = part(timeParts, 'minute');
  const second = part(timeParts, 'second');
  const period = part(timeParts, 'dayPeriod');
  const weekday = part(format({ weekday: 'long' }), 'weekday');
  const day = format({ day: 'numeric', month: 'long' }).map(item => item.value).join('');
  const zoneLabel = timeZone !== localZone ? timeZone.split('/').pop()!.replace(/_/g, ' ') : '';

  return (
    <CalmeWidget title={t('widget.clock.name')} editMode={editMode} aside={zoneLabel || undefined}>
      <div className={`ndc-clock ndc-clock--${design}`}>
        {design === 'split' ? (
          <div className="ndc-clock-split">
            <span>{hour}</span>
            <span>{minute}</span>
          </div>
        ) : (
          <div className="ndc-clock-time">
            <span className="ndc-clock-hm">{hour}<span className="ndc-clock-colon">:</span>{minute}</span>
            <span className="ndc-clock-small">
              <span>{second}</span>
              {period && <span>{period}</span>}
            </span>
          </div>
        )}
        {design !== 'minimal' && (
          <div className="ndc-clock-date">
            <span className="ndc-clock-weekday">{weekday}</span>
            <span>{day}</span>
          </div>
        )}
      </div>
    </CalmeWidget>
  );
}
