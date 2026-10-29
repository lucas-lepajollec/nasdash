'use client';

import { resetDemoTransport } from '@/lib/demoTransport';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, MousePointerClick, RotateCcw, ShieldCheck, Timer } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { useConfig } from '@/hooks/useConfig';
import { LIGHT_THEMES } from '@/lib/themes';
import { requestProductTour } from '@/components/welcome/ProductTour';
import '../../app/demo.css';

const INTRO_KEY = 'lh-demo-intro-seen';
/** Themes offered in the demo introduction, each with its preview colours. */
const DEMO_THEMES = [
  { key: 'nasdash', name: 'NasDash', swatch: 'linear-gradient(135deg, #15171c, #5fd3e6)' },
  { key: 'nord', name: 'Nord', swatch: 'linear-gradient(135deg, #2e3440, #88c0d0)' },
  { key: 'tokyo-night', name: 'Tokyo Night', swatch: 'linear-gradient(135deg, #1a1b26, #7aa2f7)' },
  { key: 'rose-pine-dark', name: 'Rosé Pine', swatch: 'linear-gradient(135deg, #191724, #eb6f92)' },
  { key: 'apple-light', name: 'Apple Light', swatch: 'linear-gradient(135deg, #f5f5f7, #0071e3)' },
];
const LINKS = {
  site: 'https://nasdash.lucas-homelab.fr',
  docs: 'https://docs.nasdash.lucas-homelab.fr',
  source: 'https://github.com/lucas-lepajollec/nasdash',
};

function readIntroSeen() {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The public demo's welcome: what NasDash is, what is safe to try, a theme to
 * try, then the dashboard tour or free exploration. A small chip reopens it.
 */
export default function DemoExperience() {
  const { t, language } = useI18n();
  const { config, updateConfig } = useConfig();
  const currentTheme = config?.settings?.theme || 'nasdash';
  const tryTheme = (theme: string) => { void updateConfig({ theme, mode: LIGHT_THEMES.includes(theme) ? 'light' : 'dark' }); };
  const [mounted, setMounted] = useState(false);
  const [isGuideOpen, setGuideOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setMounted(true);
    setGuideOpen(!readIntroSeen());
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isGuideOpen && !dialog.open) {
      dialog.showModal();
      titleRef.current?.focus({ preventScroll: true });
      dialog.scrollTop = 0;
    }
    if (!isGuideOpen && dialog.open) dialog.close();
  }, [isGuideOpen]);

  const closeGuide = () => {
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* ignore */
    }
    setGuideOpen(false);
  };

  const startTour = () => {
    closeGuide();
    window.setTimeout(requestProductTour, 250);
  };

  const resetDemo = async () => {
    try {
      sessionStorage.removeItem(INTRO_KEY);
    } catch {
      /* ignore */
    }
    setAnnouncement(t('demo.resetting'));
    await resetDemoTransport();
    await fetch('/api/demo/reset', { method: 'POST' });
    window.location.reload();
  };

  const points = [
    { icon: MousePointerClick, text: t('demo.point.edit') },
    { icon: ShieldCheck, text: t('demo.point.safe') },
    { icon: Timer, text: t('demo.point.reset') },
  ];

  if (!mounted) return null;

  return createPortal(
    <>
      <div className={`nd-demo-chip${isGuideOpen ? ' is-hidden' : ''}`}>
        <button type="button" onClick={() => setGuideOpen(true)} className="nd-demo-chip-open" aria-label={t('demo.info')}>
          <span>{t('demo.chip')}</span>
          <CircleHelp size={14} aria-hidden="true" />
        </button>
        <span className="nd-demo-chip-sep" aria-hidden="true" />
        <button type="button" onClick={() => { void resetDemo(); }} className="nd-demo-chip-reset" aria-label={t('demo.resetAria')} title={t('demo.reset')}>
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      </div>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeGuide();
        }}
        onCancel={(event) => {
          event.preventDefault();
          closeGuide();
        }}
        onClose={closeGuide}
        aria-labelledby="nd-demo-title"
        aria-describedby="nd-demo-body"
        className="nd-demo-dialog"
      >
        <div className="nd-demo-inner">
          <div className="nd-demo-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG */}
            <img src="/logo.svg" alt="" width={18} height={18} />
            NasDash
            <span className="nd-demo-badge">{t('demo.public')}</span>
          </div>

          <h2 ref={titleRef} id="nd-demo-title" tabIndex={-1} className="nd-demo-title">{t('demo.welcome.title')}</h2>
          <p id="nd-demo-body" className="nd-demo-lead">{t('demo.welcome.lead')}</p>

          <ul className="nd-demo-points">
            {points.map(({ icon: Icon, text }) => (
              <li key={text}><Icon size={15} aria-hidden="true" />{text}</li>
            ))}
          </ul>

          <div className="nd-demo-themes">
            <span className="nd-demo-label">{t('demo.themes')}</span>
            <div className="nd-demo-theme-list" role="radiogroup" aria-label={t('demo.themes')}>
              {DEMO_THEMES.map(theme => (
                <button key={theme.key} type="button" role="radio" aria-checked={currentTheme === theme.key} className="nd-demo-theme" onClick={() => tryTheme(theme.key)}>
                  <span className="nd-demo-theme-swatch" style={{ background: theme.swatch }} aria-hidden="true" />
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          <div className="nd-demo-footer">
            <nav className="nd-demo-links" aria-label={t('demo.public')}>
              <a className="ndc-text-button" href={`${LINKS.site}${language === 'en' ? '' : `/${language}`}`} target="_blank" rel="noreferrer">{t('demo.site')}</a>
              <a className="ndc-text-button" href={`${LINKS.docs}/${language}/docs`} target="_blank" rel="noreferrer">{t('demo.docs')}</a>
              <a className="ndc-text-button" href={LINKS.source} target="_blank" rel="noreferrer">{t('demo.source')}</a>
            </nav>
            <div className="nd-demo-actions">
              <button type="button" className="nd-btn" onClick={closeGuide}>{t('demo.explore')}</button>
              <button type="button" className="nd-btn nd-btn-accent" onClick={startTour}>{t('demo.tour')}</button>
            </div>
          </div>
        </div>
      </dialog>
    </>,
    document.body,
  );
}
