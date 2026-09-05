'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, RotateCcw, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

const INTRO_KEY = 'lh-demo-intro-seen';
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

export default function DemoExperience() {
  const { t } = useI18n();
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

  const resetDemo = async () => {
    try {
      sessionStorage.removeItem(INTRO_KEY);
    } catch {
      /* ignore */
    }
    setAnnouncement(t('demo.resetting'));
    await fetch('/api/demo/reset', { method: 'POST' });
    window.location.reload();
  };

  const cards = [
    { title: t('demo.try'), text: t('demo.tryBody') },
    { title: t('demo.sim'), text: t('demo.simBody') },
    { title: t('demo.never'), text: t('demo.neverBody') },
  ];

  if (!mounted) return null;

  return createPortal(
    <>
      <div className={`lh-demo-chip${isGuideOpen ? ' is-hidden' : ''}`}>
        <div className="lh-demo-chip-inner">
          <button type="button" onClick={() => setGuideOpen(true)} className="lh-demo-chip-open" aria-label={t('demo.info')}>
            <span>{t('demo.chip')}</span>
            <CircleHelp size={14} aria-hidden="true" />
          </button>
          <span className="lh-demo-chip-sep" aria-hidden="true" />
          <button
            type="button"
            onClick={() => { void resetDemo(); }}
            className="lh-demo-chip-reset"
            aria-label={t('demo.resetAria')}
            title={t('demo.reset')}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
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
        aria-labelledby="lh-demo-title"
        aria-describedby="lh-demo-body"
        className="lh-demo-dialog"
      >
        <div className="lh-demo-inner">
          <div className="lh-demo-pill">
            <ShieldCheck size={13} aria-hidden="true" />
            {t('demo.public')}
          </div>

          <h2 ref={titleRef} id="lh-demo-title" tabIndex={-1} className="lh-demo-title">
            {t('demo.title')}
          </h2>
          <p id="lh-demo-body" className="lh-demo-body">
            {t('demo.body')}
          </p>

          <div className="lh-demo-cards">
            {cards.map((card) => (
              <div key={card.title} className="lh-demo-card">
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
            ))}
          </div>

          <p className="lh-demo-limits">{t('demo.limits')}</p>

          <nav className="lh-demo-links" aria-label={t('demo.public')}>
            <a href={LINKS.site} target="_blank" rel="noreferrer">{t('demo.site')}</a>
            <a href={LINKS.docs} target="_blank" rel="noreferrer">{t('demo.docs')}</a>
            <a href={LINKS.source} target="_blank" rel="noreferrer">{t('demo.source')}</a>
          </nav>

          <div className="lh-demo-actions">
            <button type="button" onClick={() => { void resetDemo(); }} className="lh-demo-reset">
              <RotateCcw size={15} aria-hidden="true" />
              {t('demo.reset')}
            </button>
            <button type="button" onClick={closeGuide} className="lh-demo-continue">
              {t('demo.continue')}
            </button>
          </div>
        </div>
      </dialog>
    </>,
    document.body,
  );
}
