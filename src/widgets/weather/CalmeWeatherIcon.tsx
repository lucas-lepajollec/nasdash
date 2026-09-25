import React from 'react';
import { skyOf } from './useWeather';

/**
 * Line weather icons of the Calme style. `animated` gives each sky a slow,
 * quiet movement (sun rays turning, clouds drifting, drops falling…); it stops
 * when the system asks for reduced motion (design-calme.css).
 */

const CLOUD = 'M7 18.5a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19 11.5a3.5 3.5 0 0 1-.5 7H7Z';
const MOON = 'M15.5 3.5a7.5 7.5 0 1 0 5 12.6A6.5 6.5 0 0 1 15.5 3.5Z';

function Sun({ small }: { small?: boolean }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g className={small ? 'ndc-wi-sun ndc-wi-sun--small' : 'ndc-wi-sun'}>
      <circle cx="12" cy="12" r="4" />
      <g className="ndc-wi-rays">
        {rays.map(angle => <line key={angle} x1="12" y1="2.6" x2="12" y2="4.6" transform={`rotate(${angle} 12 12)`} />)}
      </g>
    </g>
  );
}

export default function CalmeWeatherIcon({ code, night = false, size = 24, animated = false }: { code: number; night?: boolean; size?: number; animated?: boolean }) {
  const sky = skyOf(code);
  const cloud = <path className="ndc-wi-cloud" d={CLOUD} />;
  let art: React.ReactNode;
  switch (sky) {
    case 'clear':
      art = night ? <path className="ndc-wi-moon" d={MOON} /> : <Sun />;
      break;
    case 'partly':
      art = (
        <>
          <g transform="translate(-3.2 -3.4) scale(0.72)">{night ? <path className="ndc-wi-moon" d={MOON} /> : <Sun small />}</g>
          <g className="ndc-wi-drift">{cloud}</g>
        </>
      );
      break;
    case 'rain':
      art = (
        <>
          <g className="ndc-wi-drift">{cloud}</g>
          {[8.5, 12, 15.5].map((x, index) => <line key={x} className="ndc-wi-drop" style={{ animationDelay: `${index * 0.35}s` }} x1={x} y1="20" x2={x - 0.8} y2="22.4" />)}
        </>
      );
      break;
    case 'snow':
      art = (
        <>
          <g className="ndc-wi-drift">{cloud}</g>
          {[8.5, 12, 15.5].map((x, index) => <circle key={x} className="ndc-wi-flake" style={{ animationDelay: `${index * 0.6}s` }} cx={x} cy="21.2" r="0.9" />)}
        </>
      );
      break;
    case 'storm':
      art = (
        <>
          <g className="ndc-wi-drift">{cloud}</g>
          <path className="ndc-wi-bolt" d="m12.5 17.5-2 3.5h3l-2 3" />
        </>
      );
      break;
    case 'fog':
      art = (
        <g className="ndc-wi-fog">
          <line x1="4" y1="9" x2="20" y2="9" />
          <line x1="3" y1="13" x2="17" y2="13" />
          <line x1="7" y1="17" x2="21" y2="17" />
        </g>
      );
      break;
    default:
      art = (
        <>
          <g transform="translate(3 -3) scale(0.8)" opacity="0.55">{cloud}</g>
          <g className="ndc-wi-drift">{cloud}</g>
        </>
      );
  }
  return (
    <svg className={`ndc-wi ${animated ? 'ndc-wi--animated' : ''}`} width={size} height={size} viewBox="0 0 24 25" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {art}
    </svg>
  );
}
