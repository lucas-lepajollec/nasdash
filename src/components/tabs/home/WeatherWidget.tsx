'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Loader2, MapPin, Moon, Sun } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const getWeatherIcon = (code: number, isDay: boolean = true, size = 24) => {
  const props = { size, className: "nd-weather-icon" };
  // WMO Weather interpretation codes
  if (code === 0) return isDay ? <Sun {...props} style={{ color: '#FDB813' }} /> : <Moon {...props} style={{ color: '#EBEBD3' }} />;
  if (code === 1 || code === 2) return isDay ? <CloudSun {...props} style={{ color: '#A2C5E5' }} /> : <CloudMoon {...props} style={{ color: '#A2C5E5' }} />;
  if (code === 3) return <Cloud {...props} style={{ color: '#9E9E9E' }} />;
  if (code >= 45 && code <= 48) return <CloudFog {...props} style={{ color: '#BDBDBD' }} />;
  if (code >= 51 && code <= 55) return <CloudDrizzle {...props} style={{ color: '#64B5F6' }} />;
  if (code >= 56 && code <= 57) return <CloudDrizzle {...props} style={{ color: '#81D4FA' }} />;
  if (code >= 61 && code <= 65) return <CloudRain {...props} style={{ color: '#42A5F5' }} />;
  if (code >= 66 && code <= 67) return <CloudRain {...props} style={{ color: '#29B6F6' }} />;
  if (code >= 71 && code <= 77) return <CloudSnow {...props} style={{ color: '#E0F7FA' }} />;
  if (code >= 80 && code <= 82) return <CloudRain {...props} style={{ color: '#1E88E5' }} />;
  if (code >= 85 && code <= 86) return <CloudSnow {...props} style={{ color: '#B2EBF2' }} />;
  if (code >= 95 && code <= 99) return <CloudLightning {...props} style={{ color: '#FFA000' }} />;
  
  return <Cloud {...props} />;
};

export default function WeatherWidget() {
  const { data, error, isLoading } = useSWR('/api/weather', fetcher, {
    refreshInterval: 1800000 // 30 minutes
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="nd-sidebar-card nd-animate-in nd-stagger-3" style={{ minHeight: '160px', opacity: 0 }}></div>;
  }

  if (isLoading && !data) {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '160px' }}>
        <Loader2 className="nd-spin" style={{ color: 'var(--nd-accent)' }} />
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="nd-sidebar-card nd-animate-in nd-stagger-3" style={{ opacity: 0.6 }}>
        <div className="nd-section-title">
          <Cloud size={12} style={{ color: 'var(--nd-accent)' }} />
          Météo
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--nd-red)', textAlign: 'center', padding: '20px 0' }}>
          {data?.error || 'Erreur météo'}
        </div>
      </div>
    );
  }

  const currentHour = new Date().getHours();
  const isDay = currentHour >= 6 && currentHour <= 20; // Rough estimation
  
  const days = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
  
  return (
    <div className="nd-sidebar-card nd-animate-in nd-stagger-3">
      <div className="nd-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cloud size={12} style={{ color: 'var(--nd-accent)' }} />
          Météo
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
          <MapPin size={10} />
          {data.location?.name}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 15px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {getWeatherIcon(data.current.weather_code, isDay, 42)}
          <div>
            <div style={{ 
              fontSize: '2.5rem', 
              fontWeight: 800, 
              lineHeight: 1,
              letterSpacing: '-0.03em'
            }}>
              {Math.round(data.current.temperature_2m)}°
            </div>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--nd-text-muted)' }}>
              Aujourd'hui
            </div>
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '8px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: '12px'
      }}>
        {[1, 2, 3].map((index) => {
          const date = new Date(data.daily.time[index]);
          const dayName = days[date.getDay()];
          const maxTemp = Math.round(data.daily.temperature_2m_max[index]);
          const minTemp = Math.round(data.daily.temperature_2m_min[index]);
          const code = data.daily.weather_code[index];
          
          return (
            <div key={index} style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              background: 'rgba(255,255,255,0.02)',
              padding: '8px 4px',
              borderRadius: 'var(--nd-card-radius)',
              gap: '6px'
            }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--nd-text-muted)' }}>
                {dayName}
              </div>
              {getWeatherIcon(code, true, 18)}
              <div style={{ display: 'flex', gap: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                <span style={{ color: 'var(--nd-text)' }}>{maxTemp}°</span>
                <span style={{ color: 'var(--nd-text-muted)', opacity: 0.7 }}>{minTemp}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
