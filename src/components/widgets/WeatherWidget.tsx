'use client';

import React, { useEffect, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { Thermometer, Droplets, Wind, MapPin, ChevronLeft, ChevronRight, CloudRain, Cloud } from 'lucide-react';
import AnimatedWeatherIcon from '@/components/shared/AnimatedWeatherIcons';
import { useWidgetSize } from './WidgetContainer';

interface WeatherData {
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

const getWeatherGlow = (code: number) => {
  if (code === 0) return '0 0 25px rgba(250, 204, 21, 0.25), inset 0 1px 3px rgba(0,0,0,0.2)'; // Yellow glow for sun
  if (code >= 51 && code <= 82 && code !== 71 && code !== 73 && code !== 75 && code !== 77) return '0 0 25px rgba(96, 165, 250, 0.25), inset 0 1px 3px rgba(0,0,0,0.2)'; // Blue glow for rain
  if (code >= 95 && code <= 99) return '0 0 30px rgba(253, 224, 71, 0.3), inset 0 1px 3px rgba(0,0,0,0.2)'; // Brighter yellow for lightning
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return '0 0 25px rgba(255, 255, 255, 0.2), inset 0 1px 3px rgba(0,0,0,0.2)'; // White for snow
  return '0 0 20px rgba(209, 213, 219, 0.1), inset 0 1px 3px rgba(0,0,0,0.2)'; // Subtle gray for clouds
};

const getWeatherLabel = (code: number) => {
  if (code === 0) return "Ciel dégagé";
  if (code === 1 || code === 2) return "Partiellement nuageux";
  if (code === 3) return "Couvert";
  if (code === 45 || code === 48) return "Brouillard";
  if (code >= 51 && code <= 55) return "Bruine";
  if (code >= 61 && code <= 67) return "Pluie";
  if (code >= 71 && code <= 77) return "Neige";
  if (code >= 80 && code <= 82) return "Averses";
  if (code >= 85 && code <= 86) return "Averses de neige";
  if (code >= 95 && code <= 99) return "Orage";
  return "Inconnu";
};

export default function WeatherWidget({ editMode }: { editMode?: boolean }) {
  const { config, setSettingsModal } = useConfig();
  const { size: widgetSize } = useWidgetSize();
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;

  const locations = config?.settings?.weatherLocations || [];
  const legacyLocation = config?.settings?.weatherLocation;
  const activeId = config?.settings?.activeWeatherLocationId;
  
  const availableLocations = React.useMemo(() => {
    return locations.length > 0 ? locations : (legacyLocation ? [{id: 'legacy', ...legacyLocation}] : []);
  }, [locations, legacyLocation]);
  
  const widgetStyle = config?.settings?.weatherWidgetStyle || 'default';
  
  const initialIndex = availableLocations.findIndex(l => l.id === activeId);
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);

  useEffect(() => {
    const idx = availableLocations.findIndex(l => l.id === config?.settings?.activeWeatherLocationId);
    if (idx >= 0) {
      setCurrentIndex(idx);
    }
  }, [config?.settings?.activeWeatherLocationId, availableLocations.length]);

  const location = availableLocations[currentIndex];

  const handlePrev = () => {
    setCurrentIndex(prev => prev === 0 ? availableLocations.length - 1 : prev - 1);
  };

  const handleNext = () => {
    setCurrentIndex(prev => prev === availableLocations.length - 1 ? 0 : prev + 1);
  };

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!location) return;
    if (location.lat === undefined || location.lon === undefined) {
      console.warn("Weather location is missing lat/lon:", location);
      setError(true);
      return;
    }

    const fetchWeather = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
        );
        if (!res.ok) throw new Error('Weather fetch failed');
        const data = await res.json();
        setWeather(data);
      } catch (e) {
        console.error(e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [location?.id, location?.lat, location?.lon]);

  if (!location) {
    return (
      <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', gap: 12 }}>
        <CloudRain size={32} className="text-gray-400 opacity-50" />
        <div style={{ fontSize: '0.8rem', color: 'var(--nd-text-muted)' }}>Météo non configurée</div>
        {editMode && (
          <button className="nd-btn nd-btn-accent text-xs px-3 py-1.5 h-auto mt-2" onClick={() => setSettingsModal({ open: true })}>
            Configurer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="nd-sidebar-card nd-animate-in" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', width: '100%', boxSizing: 'border-box' }}>
      {/* Title Header (hidden if title hidden setting is true, unless in editMode) */}
      {(!hideTitles || editMode) && (
        <div className="nd-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Cloud size={12} style={{ color: 'var(--nd-accent)' }} />
          Météo
        </div>
      )}

      {/* Internal content block wrapper that scopes padding for switcher + content */}
      <div style={{ 
        padding: widgetSize === 'wide' 
          ? '0 24px 16px 24px' 
          : widgetSize === 'medium'
            ? '0 20px 12px 20px'
            : '0 12px 12px 12px',
        display: 'flex', 
        flexDirection: 'column', 
        flex: 1 
      }}>
        {/* City Switcher Header (rendered below the title, inside the card) */}
        {location && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, position: 'relative', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {availableLocations.length > 1 && (
                <button onClick={handlePrev} style={{ background: 'none', border: 'none', color: 'var(--nd-text-muted)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                  <ChevronLeft size={14} />
                </button>
              )}
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={12} style={{ color: 'var(--nd-accent)' }} /> {location.name}
              </h3>
              {availableLocations.length > 1 && (
                <button onClick={handleNext} style={{ background: 'none', border: 'none', color: 'var(--nd-text-muted)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
            {loading && <div className="nd-spinner" style={{ position: 'absolute', right: 0, width: 12, height: 12 }} />}
          </div>
        )}

        {error ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--nd-red)', fontSize: '0.8rem', minHeight: '100px' }}>
            Erreur de chargement de la météo
          </div>
        ) : weather ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
            {/* WIDE Layout: Responsive Styles */}
            {widgetSize === 'wide' && (
              <div style={{ display: 'flex', gap: 32, alignItems: 'stretch', width: '100%', padding: '16px 0 0 0', minHeight: '180px' }}>
                
                {/* Current Weather Left Panel */}
                {(widgetStyle === 'currentOnly' || widgetStyle === 'minimal') ? (
                  <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-evenly', gap: 48 }}>
                    <div className="weather-glow" style={{ padding: 24, background: 'rgba(255,255,255,0.03)', borderRadius: '50%', boxShadow: getWeatherGlow(weather.current.weather_code) }}>
                      <AnimatedWeatherIcon code={weather.current.weather_code} size={96} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: '5rem', fontWeight: 700, lineHeight: 1, fontFamily: 'var(--font-outfit), sans-serif', textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                        {Math.round(weather.current.temperature_2m)}°
                      </div>
                      <div style={{ fontSize: '1.2rem', color: 'var(--nd-text-muted)', marginTop: 8, fontWeight: 500 }}>
                        {getWeatherLabel(weather.current.weather_code)}
                      </div>
                    </div>
                    {widgetStyle === 'currentOnly' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderLeft: '1px solid var(--nd-card-border)', paddingLeft: 48 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', color: 'var(--nd-text-muted)' }}>
                          <Thermometer size={18} className="text-blue-300" style={{ color: 'var(--nd-accent)' }} />
                          Ressenti: {Math.round(weather.current.temperature_2m)}° (Min: {Math.round(weather.daily.temperature_2m_min[0])}° / Max: {Math.round(weather.daily.temperature_2m_max[0])}°)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', color: 'var(--nd-text-muted)' }}>
                          <Wind size={18} className="text-gray-400" />
                          Vent: {Math.round(weather.current.wind_speed_10m)} km/h
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', color: 'var(--nd-text-muted)' }}>
                          <Droplets size={18} className="text-blue-400" style={{ color: 'var(--nd-accent)' }} />
                          Humidité: {weather.current.relative_humidity_2m}%
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ flex: '0 0 280px', borderRight: '1px solid var(--nd-card-border)', paddingRight: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '3.5rem', fontWeight: 700, lineHeight: 1, fontFamily: 'var(--font-outfit), sans-serif', textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                            {Math.round(weather.current.temperature_2m)}°
                          </div>
                          <div style={{ fontSize: '0.95rem', color: 'var(--nd-text-muted)', marginTop: 6, fontWeight: 500 }}>
                            {getWeatherLabel(weather.current.weather_code)}
                          </div>
                        </div>
                        <div className="weather-glow" style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: '50%', boxShadow: getWeatherGlow(weather.current.weather_code) }}>
                          <AnimatedWeatherIcon code={weather.current.weather_code} size={64} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--nd-text-muted)' }}>
                          <Thermometer size={16} className="text-blue-300" style={{ color: 'var(--nd-accent)' }} />
                          Ressenti : {Math.round(weather.current.temperature_2m)}° (Min: {Math.round(weather.daily.temperature_2m_min[0])}° / Max: {Math.round(weather.daily.temperature_2m_max[0])}°)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--nd-text-muted)' }}>
                            <Wind size={16} className="text-gray-400" />
                            {Math.round(weather.current.wind_speed_10m)} km/h
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--nd-text-muted)' }}>
                            <Droplets size={16} className="text-blue-400" style={{ color: 'var(--nd-accent)' }} />
                            {weather.current.relative_humidity_2m}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Right Panel: Forecast Grid */}
                {(widgetStyle === 'extended' || widgetStyle === 'default' || !widgetStyle) && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 32 }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20 }}>
                      Prévisions sur {widgetStyle === 'extended' ? '5' : '3'} jours
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${widgetStyle === 'extended' ? 5 : 3}, 1fr)`, gap: 16 }}>
                      {Array.from({length: widgetStyle === 'extended' ? 5 : 3}, (_, i) => i + 1).map((dayOffset) => {
                        const date = new Date(weather.daily.time[dayOffset]);
                        const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
                        return (
                          <div key={dayOffset} style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            gap: 12,
                            padding: '16px 10px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--nd-card-border)',
                            borderRadius: '16px',
                            transition: 'transform 0.2s',
                          }}
                          className="nd-weather-card-hover"
                          >
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--nd-text-muted)' }}>{dayName}</span>
                            <AnimatedWeatherIcon code={weather.daily.weather_code[dayOffset]} size={32} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--nd-text-muted)', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>
                              {getWeatherLabel(weather.daily.weather_code[dayOffset])}
                            </span>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', gap: 6, marginTop: 4 }}>
                              <span style={{ color: 'var(--nd-text)' }}>{Math.round(weather.daily.temperature_2m_max[dayOffset])}°</span>
                              <span style={{ color: 'var(--nd-text-muted)', fontWeight: 400 }}>{Math.round(weather.daily.temperature_2m_min[dayOffset])}°</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MEDIUM Layout */}
            {widgetSize === 'medium' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: (widgetStyle === 'currentOnly' || widgetStyle === 'minimal') ? 'center' : 'space-between', gap: 24, padding: '12px 0 0 0', minHeight: '130px' }}>
                {/* Left Panel: Current Weather */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div className="weather-glow" style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: '50%', boxShadow: getWeatherGlow(weather.current.weather_code) }}>
                    <AnimatedWeatherIcon code={weather.current.weather_code} size={56} />
                  </div>
                  <div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 }}>
                      {Math.round(weather.current.temperature_2m)}°
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--nd-text-muted)', marginTop: 6, fontWeight: 500 }}>
                      {getWeatherLabel(weather.current.weather_code)}
                    </div>
                  </div>
                </div>

                {/* Right Panel: Horizontal Forecast or Extra Info */}
                {(widgetStyle === 'extended' || widgetStyle === 'default' || !widgetStyle) && (
                  <div style={{ display: 'flex', gap: 24, paddingLeft: 24, borderLeft: '1px solid var(--nd-card-border)' }}>
                    {Array.from({length: widgetStyle === 'extended' ? 4 : 3}, (_, i) => i + 1).map((dayOffset) => {
                      const date = new Date(weather.daily.time[dayOffset]);
                      const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
                      return (
                        <div key={dayOffset} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--nd-text-muted)', fontWeight: 600 }}>{dayName}</span>
                          <AnimatedWeatherIcon code={weather.daily.weather_code[dayOffset]} size={28} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: 4 }}>
                            {Math.round(weather.daily.temperature_2m_max[dayOffset])}°
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {widgetStyle === 'currentOnly' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 24, borderLeft: '1px solid var(--nd-card-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--nd-text-muted)' }}>
                      <Thermometer size={14} className="text-blue-300" /> Ressenti: {Math.round(weather.current.temperature_2m)}°
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--nd-text-muted)' }}>
                      <Wind size={14} className="text-gray-400" /> {Math.round(weather.current.wind_speed_10m)} km/h
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NARROW Layout: Column Layout */}
            {widgetSize === 'narrow' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '12px 0 0 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (widgetStyle === 'minimal') ? 0 : 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1, fontFamily: 'var(--font-outfit), sans-serif', textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                      {Math.round(weather.current.temperature_2m)}°
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--nd-text-muted)', marginTop: 4, fontWeight: 500 }}>
                      {getWeatherLabel(weather.current.weather_code)}
                    </div>
                  </div>
                  <div className="weather-glow" style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: '50%', boxShadow: getWeatherGlow(weather.current.weather_code) }}>
                    <AnimatedWeatherIcon code={weather.current.weather_code} size={42} />
                  </div>
                </div>

                {widgetStyle !== 'minimal' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>
                      <Thermometer size={12} className="text-blue-300" /> 
                      {Math.round(weather.daily.temperature_2m_min[0])}° / {Math.round(weather.daily.temperature_2m_max[0])}°
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>
                        <Wind size={12} className="text-gray-400" />
                        {Math.round(weather.current.wind_speed_10m)} km/h
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>
                        <Droplets size={12} className="text-blue-400" />
                        {weather.current.relative_humidity_2m}%
                      </div>
                    </div>
                  </div>
                )}

                {(widgetStyle === 'default' || widgetStyle === 'extended') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--nd-card-border)' }}>
                    {(widgetStyle === 'extended' ? [1, 2, 3, 4, 5] : [1, 2, 3]).map((dayOffset) => {
                      const date = new Date(weather.daily.time[dayOffset]);
                      const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
                      return (
                        <div key={dayOffset} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--nd-text-muted)' }}>{dayName}</div>
                          <AnimatedWeatherIcon code={weather.daily.weather_code[dayOffset]} size={widgetStyle === 'extended' ? 14 : 18} />
                          <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                            {Math.round(weather.daily.temperature_2m_max[dayOffset])}°
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: widgetSize === 'wide' ? '180px' : '140px' }}>
            <div className="nd-spinner" style={{ width: 24, height: 24 }} />
          </div>
        )}
      </div>
    </div>
  );
}
