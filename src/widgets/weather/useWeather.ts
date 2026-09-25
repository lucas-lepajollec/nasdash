'use client';

import { useEffect, useMemo, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';

/**
 * Weather data for the Calme widget (Open-Meteo, no key): current conditions,
 * 7 days and the next 12 hours. Same locations, switching and refresh rules
 * as the historical widget.
 */

export interface WeatherData {
  current: { time?: string; temperature_2m: number; apparent_temperature?: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number; is_day?: number };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; sunrise?: string[]; sunset?: string[] };
  /** Offset of the location from UTC, to read `current.time`, sunrise and sunset as local times. */
  utc_offset_seconds?: number;
  hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[] };
}

export interface WeatherLocation { id: string; name: string; lat?: number; lon?: number }

const REFRESH_MS = 30 * 60 * 1000;

function demoWeather(): WeatherData {
  const today = new Date();
  const time = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() + index);
    return day.toISOString().slice(0, 10);
  });
  const hours = Array.from({ length: 12 }, (_, index) => {
    const hour = new Date(today);
    hour.setHours(today.getHours() + index, 0, 0, 0);
    return hour.toISOString();
  });
  return {
    current: { temperature_2m: 22.4, apparent_temperature: 21.6, weather_code: 2, wind_speed_10m: 13, relative_humidity_2m: 58, is_day: today.getHours() >= 7 && today.getHours() < 20 ? 1 : 0 },
    daily: { time, weather_code: [2, 1, 3, 61, 2, 0, 1], temperature_2m_max: [24, 26, 23, 20, 24, 27, 25], temperature_2m_min: [15, 16, 14, 13, 14, 17, 16] },
    hourly: { time: hours, temperature_2m: [22, 22, 21, 20, 18, 17, 16, 16, 15, 15, 14, 14], weather_code: [2, 2, 2, 3, 3, 3, 3, 2, 1, 1, 0, 0] },
  };
}

export function weatherUrl(location: Required<Pick<WeatherLocation, 'lat' | 'lon'>>): string {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
    hourly: 'temperature_2m,weather_code',
    forecast_hours: '12',
    timezone: 'auto',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function useWeather(isVisible: boolean) {
  const { config } = useConfig();
  const saved = config?.settings?.weatherLocations;
  const legacy = config?.settings?.weatherLocation;
  const locations = useMemo<WeatherLocation[]>(
    () => (saved && saved.length ? saved : legacy ? [{ id: 'legacy', ...legacy }] : []) as WeatherLocation[],
    [saved, legacy],
  );
  const activeId = config?.settings?.activeWeatherLocationId;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const found = locations.findIndex(location => location.id === activeId);
    if (found >= 0) setIndex(found);
  }, [activeId, locations]);

  const location = locations[index] ?? locations[0];
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const demo = config?.demoMode === true;

  useEffect(() => {
    if (!isVisible || !location) return;
    if (location.lat === undefined || location.lon === undefined) { setError(true); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        if (demo) { setWeather(demoWeather()); return; }
        const response = await fetch(weatherUrl({ lat: location.lat!, lon: location.lon! }));
        if (!response.ok) throw new Error('Weather fetch failed');
        const data = await response.json() as WeatherData;
        if (!cancelled) setWeather(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    if (demo) return () => { cancelled = true; };
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [isVisible, location, demo]);

  const step = (delta: number) => setIndex(current => (current + delta + locations.length) % locations.length);
  return { locations, location, weather, loading, error, previous: () => step(-1), next: () => step(1) };
}

export function weatherLabelKey(code: number): string {
  if (code === 0) return 'weather.clear';
  if (code === 1 || code === 2) return 'weather.partlyCloudy';
  if (code === 3) return 'weather.overcast';
  if (code === 45 || code === 48) return 'weather.fog';
  if (code >= 51 && code <= 55) return 'weather.drizzle';
  if (code >= 61 && code <= 67) return 'weather.rain';
  if (code >= 71 && code <= 77) return 'weather.snow';
  if (code >= 80 && code <= 82) return 'weather.showers';
  if (code >= 85 && code <= 86) return 'weather.snowShowers';
  if (code >= 95 && code <= 99) return 'weather.thunderstorm';
  return 'weather.unknown';
}

export type Sky = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';
export type TimeOfDay = 'day' | 'night' | 'dawn' | 'dusk';

/** Weather code → the few skies the widget draws. */
export function skyOf(code: number): Sky {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51) return 'rain';
  return 'cloudy';
}

/** Day, night, or the hour around sunrise and sunset, at the location. */
export function timeOfDay(weather: WeatherData): TimeOfDay {
  const minutes = (iso?: string) => {
    const match = iso?.match(/T(\d{2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
  };
  const now = minutes(weather.current.time);
  const rise = minutes(weather.daily.sunrise?.[0]);
  const set = minutes(weather.daily.sunset?.[0]);
  if (now !== undefined && rise !== undefined && Math.abs(now - rise) <= 45) return 'dawn';
  if (now !== undefined && set !== undefined && Math.abs(now - set) <= 45) return 'dusk';
  return weather.current.is_day === 0 ? 'night' : 'day';
}
