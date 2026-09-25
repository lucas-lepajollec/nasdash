import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading, CalmeRow, CalmeSegmented } from '../../shared/CalmeControls';
import { X } from 'lucide-react';

interface WeatherSearchResult {
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
  country?: string;
}

export function WeatherWidgetTab() {
  const { t, language, locale } = useI18n();
  const { config, updateConfig } = useConfig();
  const demoMode = config?.demoMode === true;
  
  const [weatherSearchQuery, setWeatherSearchQuery] = useState('');
  const [weatherSearchResults, setWeatherSearchResults] = useState<WeatherSearchResult[]>([]);
  const [isSearchingWeather, setIsSearchingWeather] = useState(false);

  const searchWeatherCity = async () => {
    if (!weatherSearchQuery.trim()) return;
    setIsSearchingWeather(true);
    try {
      if (demoMode) {
        const sampleCities: WeatherSearchResult[] = [
          { name: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522 },
          { name: 'Montréal', country: 'Canada', latitude: 45.5019, longitude: -73.5674 },
          { name: 'Bruxelles', country: 'Belgique', latitude: 50.8503, longitude: 4.3517 },
          { name: 'Tokyo', country: 'Japon', latitude: 35.6762, longitude: 139.6503 },
        ];
        const query = weatherSearchQuery.trim().toLocaleLowerCase(locale);
        setWeatherSearchResults(sampleCities.filter(city => city.name.toLocaleLowerCase(locale).includes(query)));
        return;
      }
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(weatherSearchQuery)}&count=5&language=${language}&format=json`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json() as { results?: WeatherSearchResult[] };
      setWeatherSearchResults(data.results || []);
    } catch (e) {
      console.error(e);
      setWeatherSearchResults([]);
    } finally {
      setIsSearchingWeather(false);
    }
  };

  const selectWeatherCity = async (city: WeatherSearchResult) => {
    const newId = Math.random().toString(36).substring(2, 9);
    const loc = { id: newId, lat: city.latitude, lon: city.longitude, name: city.name };
    const currentLocations = config?.settings?.weatherLocations || [];
    
    // Migrate old single location if present and list is empty
    if (currentLocations.length === 0 && config?.settings?.weatherLocation) {
      currentLocations.push({ id: 'legacy-1', ...config.settings.weatherLocation });
    }

    const newLocations = [...currentLocations, loc];
    
    // Set as active if it's the first one
    const newActiveId = currentLocations.length === 0 ? newId : (config?.settings?.activeWeatherLocationId || currentLocations[0]?.id || newId);

    await updateConfig({ 
      weatherLocations: newLocations,
      activeWeatherLocationId: newActiveId
    });
    
    setWeatherSearchResults([]);
    setWeatherSearchQuery('');
  };

  const removeWeatherCity = async (idToRemove: string) => {
    const currentLocations = config?.settings?.weatherLocations || [];
    const newLocations = currentLocations.filter(loc => loc.id !== idToRemove);
    
    let newActiveId = config?.settings?.activeWeatherLocationId;
    if (newActiveId === idToRemove) {
      newActiveId = newLocations.length > 0 ? newLocations[0].id : undefined;
    }

    await updateConfig({
      weatherLocations: newLocations,
      activeWeatherLocationId: newActiveId
    });
  };

  const setActiveWeatherCity = async (id: string) => {
    await updateConfig({ activeWeatherLocationId: id });
  };

  const locations = config?.settings?.weatherLocations || [];
  const style = config?.settings?.weatherWidgetStyle || 'default';
  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="weather" />
      <section className="ndc-set-block">
        <CalmeHeading info={t("Recherchez votre ville pour afficher la météo correspondante.")}>{t('settings.calme.places')}</CalmeHeading>
        <div className="ndc-field">
          <input
            type="text"
            aria-label={t("Rechercher une ville")}
            className="nd-input"
            placeholder={t("Ex: Paris, Tokyo...")}
            value={weatherSearchQuery}
            onChange={(e) => setWeatherSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchWeatherCity()}
          />
          <button type="button" className="nd-btn" onClick={searchWeatherCity} disabled={isSearchingWeather || !weatherSearchQuery.trim()}>
            {isSearchingWeather ? '…' : t("Chercher")}
          </button>
        </div>
        {weatherSearchResults.length > 0 && (
          <div className="ndc-set-list" style={{ marginTop: 6 }}>
            {weatherSearchResults.map((city, idx) => (
              <button key={idx} type="button" className="ndc-set-list-item" onClick={() => selectWeatherCity(city)}>
                <span>{city.name}</span>
                <span className="ndc-set-list-sub">{[city.admin1, city.country].filter(Boolean).join(', ')}</span>
              </button>
            ))}
          </div>
        )}
        <div className="ndc-set-list" style={{ marginTop: 14 }} role="radiogroup" aria-label={t("Villes enregistrées")}>
          {locations.map(loc => {
            const isActive = config?.settings?.activeWeatherLocationId === loc.id || locations.length === 1;
            return (
              <div key={loc.id} className="ndc-set-list-row">
                <button type="button" role="radio" aria-checked={isActive} className="ndc-radio-label" onClick={() => setActiveWeatherCity(loc.id)}>
                  <span className={`ndc-radio ${isActive ? 'is-on' : ''}`} aria-hidden="true" />
                  {loc.name}
                </button>
                <button
                  type="button"
                  className="ndc-icon-button"
                  aria-label={t("Supprimer")}
                  title={t("Supprimer")}
                  onClick={() => { if (window.confirm(t('weather.confirmDeleteCity', { city: loc.name }))) removeWeatherCity(loc.id); }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="ndc-set-block">
        <CalmeHeading>{t('settings.calme.display')}</CalmeHeading>
        <CalmeRow label={t("Style du Widget Météo")} info={t('settings.calme.weatherStyles')}>
          <CalmeSegmented
            label={t("Style du Widget Météo")}
            value={style}
            options={[
              { value: 'minimal', label: t('settings.calme.weatherMinimal') },
              { value: 'currentOnly', label: t('settings.calme.weatherNow') },
              { value: 'default', label: t('settings.calme.weather3') },
              { value: 'extended', label: t('settings.calme.weather5') },
            ]}
            onChange={async (value) => { await updateConfig({ weatherWidgetStyle: value }); }}
          />
        </CalmeRow>
      </section>
    </div>
  );
}
