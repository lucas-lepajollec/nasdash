import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import { WidgetLayoutConfig } from '../../shared/WidgetLayoutConfig';
import { WidgetDockerLayoutConfig } from '../../shared/WidgetDockerLayoutConfig';
import { WidgetNetworksLayoutConfig } from '../../shared/WidgetNetworksLayoutConfig';
import { CheckCircle2, Trash2 } from 'lucide-react';

export function WeatherWidgetTab() {
  const { config, updateConfig } = useConfig();

  const hideWeather = !!config?.settings?.hideWeather;
  
  const [weatherSearchQuery, setWeatherSearchQuery] = useState('');
  const [weatherSearchResults, setWeatherSearchResults] = useState<any[]>([]);
  const [isSearchingWeather, setIsSearchingWeather] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<{id: string, name: string} | null>(null);

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  const searchWeatherCity = async () => {
    if (!weatherSearchQuery.trim()) return;
    setIsSearchingWeather(true);
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(weatherSearchQuery)}&count=5&language=fr&format=json`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setWeatherSearchResults(data.results || []);
    } catch (e) {
      console.error(e);
      setWeatherSearchResults([]);
    } finally {
      setIsSearchingWeather(false);
    }
  };

  const selectWeatherCity = async (city: any) => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={!hideWeather}
          onChange={(val) => handleToggleWidget('hideWeather', !val)}
          label="Activer le widget Météo"
          sublabel="Affiche la météo locale sur votre tableau de bord."
        />
      </div>

      {!hideWeather && (
        <>
          <WidgetLayoutConfig widgetId="weather" />
          <WidgetDockerLayoutConfig widgetId="weather" />
          <WidgetNetworksLayoutConfig widgetId="weather" />

          {/* Weather Location Search */}
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Localisation (OpenMeteo)</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
              Recherchez votre ville pour afficher la météo correspondante.
            </p>
            
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                className="nd-input"
                placeholder="Ex: Paris, Tokyo..."
                value={weatherSearchQuery}
                onChange={(e) => setWeatherSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchWeatherCity()}
                style={{ flex: 1, fontSize: '0.75rem', padding: '10px 14px' }}
              />
              <button 
                className="nd-btn nd-btn-accent" 
                onClick={searchWeatherCity}
                disabled={isSearchingWeather || !weatherSearchQuery.trim()}
                style={{ padding: '10px 16px', fontSize: '0.75rem' }}
              >
                {isSearchingWeather ? '...' : 'Chercher'}
              </button>
            </div>

            {weatherSearchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', padding: 8 }}>
                {weatherSearchResults.map((city, idx) => (
                  <div 
                    key={idx}
                    onClick={() => selectWeatherCity(city)}
                    style={{ padding: '8px 12px', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  >
                    <span style={{ fontWeight: 600 }}>{city.name}</span>
                    {city.admin1 && <span style={{ color: 'var(--nd-text-muted)' }}>, {city.admin1}</span>}
                    {city.country && <span style={{ color: 'var(--nd-text-muted)' }}> ({city.country})</span>}
                  </div>
                ))}
              </div>
            )}

            {config?.settings?.weatherLocations && config.settings.weatherLocations.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', fontWeight: 600 }}>Villes enregistrées</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {config.settings.weatherLocations.map((loc) => {
                    const isActive = config.settings?.activeWeatherLocationId === loc.id || (config.settings?.weatherLocations?.length === 1);
                    return (
                      <div key={loc.id} style={{ padding: '8px 12px', background: isActive ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.2)' : 'var(--nd-card-border)'}`, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }} onClick={() => setActiveWeatherCity(loc.id)}>
                          {isActive ? <CheckCircle2 size={16} color="var(--nd-green)" /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--nd-card-border)' }} />}
                          <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--nd-green)' : 'var(--nd-text)' }}>{loc.name}</span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            // We can use native confirm to keep it self-contained instead of a custom modal for now
                            if (window.confirm(`Voulez-vous vraiment supprimer la ville de ${loc.name} ?`)) {
                                removeWeatherCity(loc.id);
                            }
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--nd-red)', cursor: 'pointer', padding: 4, opacity: 0.6, transition: 'opacity 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Style selector */}
            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)', marginBottom: 12 }}>Style du Widget Météo</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { id: 'default', name: 'Standard', desc: 'Météo actuelle + 3 prochains jours' },
                  { id: 'extended', name: 'Étendu', desc: 'Météo actuelle + 5 prochains jours' },
                  { id: 'currentOnly', name: 'Actuelle', desc: 'Uniquement la météo actuelle avec détails' },
                  { id: 'minimal', name: 'Minimaliste', desc: 'Juste la température et l\'icône' }
                ].map(design => (
                  <div 
                    key={design.id}
                    onClick={async () => {
                      await updateConfig({ weatherWidgetStyle: design.id });
                    }}
                    style={{ 
                      padding: '12px', borderRadius: 'var(--nd-card-radius)', cursor: 'pointer', transition: 'var(--nd-transition)',
                      border: `1px solid ${config?.settings?.weatherWidgetStyle === design.id ? 'var(--nd-accent)' : 'var(--nd-card-border)'}`,
                      background: config?.settings?.weatherWidgetStyle === design.id ? 'var(--nd-accent-glow)' : 'rgba(0,0,0,0.2)',
                      color: config?.settings?.weatherWidgetStyle === design.id ? 'var(--nd-accent)' : 'var(--nd-text)',
                      boxShadow: config?.settings?.weatherWidgetStyle === design.id ? '0 0 8px var(--nd-accent-glow)' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>{design.name}</div>
                    <div style={{ fontSize: '0.62rem', color: config?.settings?.weatherWidgetStyle === design.id ? 'inherit' : 'var(--nd-text-muted)', opacity: 0.8 }}>{design.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
