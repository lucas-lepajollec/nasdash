import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';

// Cache in memory
const globalAny = global as any;
if (!globalAny.weatherCache) {
  globalAny.weatherCache = {
    data: null,
    lastFetch: 0,
    lastLocation: ''
  };
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  try {
    const config = readConfig();
    const locationName = config.settings?.weatherLocation || 'Paris';

    // Return cache if valid and location hasn't changed
    const now = Date.now();
    if (
      globalAny.weatherCache.data &&
      globalAny.weatherCache.lastLocation === locationName &&
      (now - globalAny.weatherCache.lastFetch) < CACHE_DURATION
    ) {
      return NextResponse.json(globalAny.weatherCache.data);
    }

    // 1. Geocoding
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=fr&format=json`);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return NextResponse.json({ error: 'Ville introuvable' }, { status: 404 });
    }

    const { latitude, longitude, name, country } = geoData.results[0];

    // 2. Weather forecast
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
    const weatherData = await weatherRes.json();

    const responseData = {
      location: { name, country },
      current: weatherData.current,
      daily: weatherData.daily
    };

    // Update cache
    globalAny.weatherCache.data = responseData;
    globalAny.weatherCache.lastFetch = now;
    globalAny.weatherCache.lastLocation = locationName;

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Weather API Error:', error);
    // If error but we have cache, return cache
    if (globalAny.weatherCache.data) {
      return NextResponse.json(globalAny.weatherCache.data);
    }
    return NextResponse.json({ error: 'Erreur lors de la récupération de la météo' }, { status: 500 });
  }
}
