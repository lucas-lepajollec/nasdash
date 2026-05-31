import React from 'react';

// Common base paths
const cloudPath = "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z";

// Base sun core
const sunCore = <circle cx="12" cy="12" r="4" />;

const animStyles = `
  @keyframes nd-weather-sun-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes nd-weather-ray-fade { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
  @keyframes nd-weather-drop-fall { 0% { transform: translateY(-4px); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(8px); opacity: 0; } }
  @keyframes nd-weather-lightning { 0%, 100% { opacity: 0; transform: translateY(-3px); } 5%, 15% { opacity: 1; transform: translateY(0); } 10% { opacity: 0; } 20% { opacity: 0; } }
  @keyframes nd-weather-cloud-fade { 0%, 100% { opacity: 0; transform: translateX(6px) scale(0.7); } 50% { opacity: 1; transform: translateX(0) scale(1); } }
  @keyframes nd-weather-snow-fall { 0% { transform: translateY(-4px) rotate(0deg); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(8px) rotate(180deg); opacity: 0; } }
  @keyframes nd-weather-fog-drift { 0%, 100% { transform: translateX(-3px); opacity: 0.5; } 50% { transform: translateX(3px); opacity: 1; } }
  @keyframes nd-weather-partly-cloud { 0%, 100% { opacity: 0; transform: translateX(6px); } 20% { opacity: 1; } 80% { opacity: 1; } 50% { transform: translateX(0); } }
`;

export const AnimSun = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 drop-shadow-md">
    <style>{animStyles}</style>
    <g style={{ transformOrigin: '12px 12px', animation: 'nd-weather-sun-spin 30s linear infinite' }}>
      {sunCore}
      {/* 4 main rays appearing alternately */}
      <path d="M12 2v2" style={{ animation: 'nd-weather-ray-fade 4s ease-in-out infinite 0s' }} />
      <path d="M12 20v2" style={{ animation: 'nd-weather-ray-fade 4s ease-in-out infinite 2s' }} />
      <path d="M2 12h2" style={{ animation: 'nd-weather-ray-fade 4s ease-in-out infinite 1s' }} />
      <path d="M20 12h2" style={{ animation: 'nd-weather-ray-fade 4s ease-in-out infinite 3s' }} />
      {/* 4 diagonal rays appearing alternately */}
      <path d="M4.93 4.93l1.41 1.41" style={{ animation: 'nd-weather-ray-fade 4s ease-in-out infinite 0.5s' }} />
      <path d="M17.66 17.66l1.41 1.41" style={{ animation: 'nd-weather-ray-fade 4s ease-in-out infinite 2.5s' }} />
      <path d="M6.34 17.66l-1.41 1.41" style={{ animation: 'nd-weather-ray-fade 4s ease-in-out infinite 1.5s' }} />
      <path d="M19.07 4.93l-1.41 1.41" style={{ animation: 'nd-weather-ray-fade 4s ease-in-out infinite 3.5s' }} />
    </g>
  </svg>
);

export const AnimCloud = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 drop-shadow-md">
    <style>{animStyles}</style>
    <path d={cloudPath} />
    {/* Small cloud fading in and out next to it */}
    <g style={{ animation: 'nd-weather-cloud-fade 6s ease-in-out infinite' }}>
      <path d="M5 16H3a2 2 0 1 1 1.8-3h.6a1.5 1.5 0 1 1 0 3Z" strokeWidth="1.5" opacity="0.8" />
    </g>
  </svg>
);

export const AnimRain = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 drop-shadow-md">
    <style>{animStyles}</style>
    <path d="M17.5 17H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" className="text-blue-300" />
    {/* Falling drops */}
    <path d="M8 19v2" style={{ animation: 'nd-weather-drop-fall 1.5s infinite 0s' }} />
    <path d="M12 19v2" style={{ animation: 'nd-weather-drop-fall 1.5s infinite 0.5s' }} />
    <path d="M16 19v2" style={{ animation: 'nd-weather-drop-fall 1.5s infinite 1s' }} />
  </svg>
);

export const AnimStorm = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-300 drop-shadow-md">
    <style>{animStyles}</style>
    <path d="M17.5 17H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" className="text-yellow-200" />
    {/* Lightning bolts appearing alternately */}
    <polygon points="13 14 9 20 13 20 11 26 15 20 11 20" style={{ animation: 'nd-weather-lightning 4s infinite 0s', transformOrigin: '11px 20px' }} fill="currentColor" strokeWidth="1" />
    <polygon points="10 12 7 17 10 17 8 21 12 17 9 17" style={{ animation: 'nd-weather-lightning 4s infinite 1.3s', transformOrigin: '9px 17px' }} fill="currentColor" strokeWidth="1" />
    <polygon points="16 13 13 18 16 18 14 22 18 18 15 18" style={{ animation: 'nd-weather-lightning 4s infinite 2.6s', transformOrigin: '15px 18px' }} fill="currentColor" strokeWidth="1" />
  </svg>
);

export const AnimFog = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 drop-shadow-md">
    <style>{animStyles}</style>
    <path d="M17.5 16H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    {/* Fog lines drifting */}
    <line x1="6" y1="20" x2="18" y2="20" style={{ animation: 'nd-weather-fog-drift 5s ease-in-out infinite 0s' }} />
    <line x1="8" y1="23" x2="16" y2="23" style={{ animation: 'nd-weather-fog-drift 5s ease-in-out infinite 2.5s' }} />
  </svg>
);

export const AnimSnow = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-md">
    <style>{animStyles}</style>
    <path d="M17.5 17H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" className="text-blue-300" />
    {/* Snowflakes falling */}
    <g style={{ animation: 'nd-weather-snow-fall 2.5s infinite 0s', transformOrigin: '8px 20px' }}>
      <line x1="8" y1="19" x2="8" y2="21" /><line x1="7" y1="20" x2="9" y2="20" />
    </g>
    <g style={{ animation: 'nd-weather-snow-fall 2.5s infinite 0.8s', transformOrigin: '12px 20px' }}>
      <line x1="12" y1="19" x2="12" y2="21" /><line x1="11" y1="20" x2="13" y2="20" />
    </g>
    <g style={{ animation: 'nd-weather-snow-fall 2.5s infinite 1.6s', transformOrigin: '16px 20px' }}>
      <line x1="16" y1="19" x2="16" y2="21" /><line x1="15" y1="20" x2="17" y2="20" />
    </g>
  </svg>
);

export const AnimPartlyCloudy = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <style>{animStyles}</style>
    {/* Static sun behind */}
    <g className="text-yellow-400">
      <circle cx="10" cy="10" r="3" />
      <path d="M10 4v2" /><path d="M10 14v2" /><path d="M5 5l1.4 1.4" /><path d="M13.6 13.6l1.4 1.4" /><path d="M4 10h2" /><path d="M14 10h2" /><path d="M6.4 13.6L5 15" /><path d="M15 5l-1.4 1.4" />
    </g>
    {/* Cloud moving in front (Reduced size) */}
    <g style={{ animation: 'nd-weather-partly-cloud 8s ease-in-out infinite' }}>
      <path d="M17.5 19H11a5 5 0 1 1 4.71-7h1.79a3.5 3.5 0 1 1 0 7Z" className="text-gray-300 drop-shadow-md" fill="rgba(var(--nd-card-bg-rgb), 0.8)" strokeWidth="1.5" />
    </g>
  </svg>
);

export default function AnimatedWeatherIcon({ code, size = 24 }: { code: number; size?: number }) {
  if (code === 0) return <AnimSun size={size} />;
  if (code === 1 || code === 2) return <AnimPartlyCloudy size={size} />;
  if (code === 3) return <AnimCloud size={size} />;
  if (code === 45 || code === 48) return <AnimFog size={size} />;
  if (code >= 51 && code <= 67) return <AnimRain size={size} />;
  if (code >= 71 && code <= 77) return <AnimSnow size={size} />;
  if (code >= 80 && code <= 82) return <AnimRain size={size} />;
  if (code >= 85 && code <= 86) return <AnimSnow size={size} />;
  if (code >= 95 && code <= 99) return <AnimStorm size={size} />;
  return <AnimCloud size={size} />;
}
