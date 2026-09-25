'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeWidget } from '../calme';
import CalmeWeatherIcon from './CalmeWeatherIcon';
import { skyOf, timeOfDay, useWeather, weatherLabelKey } from './useWeather';

/**
 * Calme weather. Styles (Settings → Weather): "minimal" = temperature and sky,
 * "currentOnly" = plus details, "default" = plus 3 days, "extended" = plus
 * the next hours and 5 days. Narrow blocks drop the secondary parts instead
 * of squeezing them (container queries in design-calme.css). A quiet scene
 * behind follows the sky and the time of day at the location.
 */
export default function CalmeWeather({ editMode, isVisible = true }: { editMode?: boolean; isVisible?: boolean }) {
  const { t, locale } = useI18n();
  const { config, setSettingsModal } = useConfig();
  const style = config?.settings?.weatherWidgetStyle || 'default';
  const { locations, location, weather, loading, error, previous, next } = useWeather(isVisible);
  const round = (value: number) => Math.round(value);

  if (!location) {
    return (
      <CalmeWidget title={t('widget.weather.name')} editMode={editMode}>
        <div className="ndc-empty">
          <span>{t('Météo non configurée')}</span>
          {editMode && <button type="button" className="nd-btn nd-btn-accent" onClick={() => setSettingsModal({ open: true, targetTab: 'widget-weather' })}>{t('Configurer')}</button>}
        </div>
      </CalmeWidget>
    );
  }

  if (error || !weather) {
    return (
      <CalmeWidget title={t('widget.weather.name')} editMode={editMode}>
        {error
          ? <div className="ndc-empty ndc-empty--error">{t('Erreur de chargement de la météo')}</div>
          : <div className="ndc-empty"><span className="nd-spinner" style={{ width: 18, height: 18 }} /></div>}
      </CalmeWidget>
    );
  }

  const sky = skyOf(weather.current.weather_code);
  const moment = timeOfDay(weather);
  const night = moment === 'night';
  const many = locations.length > 1;
  const days = style === 'extended' ? 5 : 3;
  const hourly = weather.hourly;
  const hours = (hourly?.temperature_2m ?? []).slice(0, 8);
  const low = Math.min(...hours), high = Math.max(...hours), span = high - low || 1;

  return (
    <CalmeWidget
      title={t('widget.weather.name')}
      editMode={editMode}
      aside={loading ? <span className="nd-spinner" style={{ width: 10, height: 10 }} /> : undefined}
    >
      <div className="ndc-weather" data-sky={sky} data-time={moment} data-style={style}>
        <div className="ndc-weather-scene" aria-hidden="true">
          <span className="ndc-scene-light" />
          <span className="ndc-scene-stars" />
          <span className="ndc-scene-cloud ndc-scene-cloud--a" />
          <span className="ndc-scene-cloud ndc-scene-cloud--b" />
          <span className="ndc-scene-precip" />
          <span className="ndc-scene-flash" />
        </div>

        <div className="ndc-weather-main">
          {/* The sky is told by the icon; its name stays as a tooltip. */}
          <span className="ndc-weather-icon" title={t(weatherLabelKey(weather.current.weather_code))} role="img" aria-label={t(weatherLabelKey(weather.current.weather_code))}>
            <CalmeWeatherIcon code={weather.current.weather_code} night={night} size={38} animated />
          </span>
          <span className="ndc-weather-temp">{round(weather.current.temperature_2m)}°</span>
          {style !== 'minimal' && (
            <span className="ndc-weather-range">
              <span>↑ {round(weather.daily.temperature_2m_max[0])}°</span>
              <span>↓ {round(weather.daily.temperature_2m_min[0])}°</span>
            </span>
          )}
        </div>

        <div className="ndc-weather-line">
          {many && <button type="button" className="ndc-icon-button" onClick={previous} aria-label={t('weather.calme.previousPlace')}><ChevronLeft size={13} /></button>}
          <span className="ndc-weather-place" title={location.name}>{location.name}</span>
          {many && <button type="button" className="ndc-icon-button" onClick={next} aria-label={t('weather.calme.nextPlace')}><ChevronRight size={13} /></button>}
        </div>

        {(style === 'currentOnly' || style === 'extended') && (
          <div className="ndc-weather-details">
            {weather.current.apparent_temperature !== undefined && <span>{t('weather.calme.feelsLike', { value: round(weather.current.apparent_temperature) })}</span>}
            <span>{round(weather.current.wind_speed_10m)} km/h</span>
            <span>{weather.current.relative_humidity_2m} %</span>
          </div>
        )}

        {style === 'extended' && hourly && hours.length > 1 && (
          <div className="ndc-weather-hours" aria-label={t('weather.calme.nextHours')}>
            {hours.map((temp, index) => (
              <div key={hourly.time[index]} className="ndc-weather-hour">
                <span className={index === 0 ? 'ndc-weather-hour-now' : undefined}>{round(temp)}°</span>
                <span className={`ndc-weather-bar ${index === 0 ? 'ndc-weather-bar--now' : ''}`} style={{ height: `${8 + ((temp - low) / span) * 22}px` }} />
                <span>{new Date(hourly.time[index]).toLocaleTimeString(locale, { hour: '2-digit', hourCycle: 'h23' }).replace(/\D/g, '')}</span>
              </div>
            ))}
          </div>
        )}

        {(style === 'default' || style === 'extended') && (
          <div className="ndc-weather-days">
            {Array.from({ length: days }, (_, offset) => offset + 1).map(day => (
              <div key={weather.daily.time[day]} className="ndc-weather-day">
                <span className="ndc-weather-day-name">{new Date(weather.daily.time[day]).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')}</span>
                <CalmeWeatherIcon code={weather.daily.weather_code[day]} size={18} />
                <span className="ndc-weather-day-temps">
                  <span>{round(weather.daily.temperature_2m_max[day])}°</span>
                  <span className="ndc-weather-day-min">{round(weather.daily.temperature_2m_min[day])}°</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </CalmeWidget>
  );
}
