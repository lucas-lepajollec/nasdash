'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/i18n/I18nProvider';
import '../../app/tour.css';

/**
 * A short tour of the dashboard's buttons: the page darkens, one button stays lit, and a bubble points at it.
 * Shown once after the first-run guide, and again from Settings → Help.
 */
interface TourStep {
  id: string;
  /** `[data-tour="…"]` anchor, or a selector; none for the welcome bubble in the middle of the screen. */
  target?: string;
  /** The step shows a button of edit mode. */
  edit?: boolean;
  /** On a small screen the button sits in the menu: this step points at the menu instead. */
  inMenu?: boolean;
}

const STEPS: readonly TourStep[] = [
  { id: 'welcome' },
  { id: 'pages', target: '[data-tour="pages"]' },
  { id: 'widget', target: '.nd-tab-view .nd-page-widget' },
  { id: 'edit', target: '[data-tour="edit"]', inMenu: true },
  { id: 'addWidget', target: '[data-tour="add-widget"]', edit: true },
  { id: 'settings', target: '[data-tour="settings"]', inMenu: true },
  { id: 'privacy', target: '[data-tour="privacy"]', inMenu: true },
];

const MENU = '[data-tour="menu"]';
const SPOT_PADDING = 6;
const GAP = 14;
const MARGIN = 16;

/** The first anchor matching the selector that is on screen (the header renders desktop and mobile variants). */
function visible(selector: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) ?? null;
}

/** Steps for this screen: those inside the menu become one menu step on a phone; missing anchors are skipped. */
function stepsForScreen(): TourStep[] {
  const steps: TourStep[] = [];
  for (const step of STEPS) {
    if (!step.target || step.edit || visible(step.target)) steps.push(step);
    else if (step.inMenu && visible(MENU) && !steps.some(item => item.id === 'menu')) steps.push({ id: 'menu', target: MENU });
  }
  return steps;
}

interface Placement { spot: DOMRect | null; top: number; left: number; arrow: number; side: 'above' | 'below' | 'none' }

export function ProductTour({ onEnterEdit, onLeaveEdit, onClose }: { onEnterEdit: () => void; onLeaveEdit: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const [steps] = useState(stepsForScreen);
  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const editing = useRef(false);
  const editCallbacks = useRef({ onEnterEdit, onLeaveEdit });
  useEffect(() => { editCallbacks.current = { onEnterEdit, onLeaveEdit }; });

  // Edit mode only for the steps that show its buttons, and never left on after the tour.
  useEffect(() => {
    if (step.edit && !editing.current) { editing.current = true; editCallbacks.current.onEnterEdit(); }
    if (!step.edit && editing.current) { editing.current = false; editCallbacks.current.onLeaveEdit(); }
  }, [step]);
  useEffect(() => () => { if (editing.current) editCallbacks.current.onLeaveEdit(); }, []);

  const place = useCallback(() => {
    const box = bubble.current?.getBoundingClientRect();
    const width = box?.width ?? 320;
    const height = box?.height ?? 180;
    const target = step.target ? visible(step.target) : null;
    if (!target) {
      setPlacement({ spot: null, top: Math.max(MARGIN, (window.innerHeight - height) / 2), left: Math.max(MARGIN, (window.innerWidth - width) / 2), arrow: 0, side: 'none' });
      return;
    }
    const rect = target.getBoundingClientRect();
    const below = rect.bottom + SPOT_PADDING + GAP + height <= window.innerHeight - MARGIN || rect.top < height + GAP + MARGIN;
    const top = below ? rect.bottom + SPOT_PADDING + GAP : rect.top - SPOT_PADDING - GAP - height;
    const center = rect.left + rect.width / 2;
    const left = Math.min(Math.max(MARGIN, center - width / 2), window.innerWidth - width - MARGIN);
    setPlacement({ spot: rect, top, left, arrow: Math.min(Math.max(18, center - left), width - 18), side: below ? 'below' : 'above' });
  }, [step]);

  // Anchors of edit mode appear a moment after it starts: look again for a short while.
  useLayoutEffect(() => {
    let frame = 0;
    let tries = 0;
    const seek = () => {
      place();
      if (step.target && !visible(step.target) && tries++ < 40) frame = window.requestAnimationFrame(seek);
    };
    seek();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [place, step]);

  useEffect(() => { primary.current?.focus({ preventScroll: true }); }, [index]);

  const next = useCallback(() => { if (index >= steps.length - 1) onClose(); else setIndex(index + 1); }, [index, steps.length, onClose]);
  const back = useCallback(() => setIndex(current => Math.max(0, current - 1)), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, onClose]);

  const counted = steps.filter(item => item.target);
  const position = counted.indexOf(step) + 1;
  const last = index === steps.length - 1;
  const spot = placement?.spot;

  return createPortal(
    <div className="nd-tour" role="presentation">
      {/* Catches clicks: the page waits while the tour talks about it. */}
      <div className="nd-tour-blocker" />
      <div
        className={`nd-tour-spot ${spot ? '' : 'is-hidden'}`}
        style={spot ? { top: spot.top - SPOT_PADDING, left: spot.left - SPOT_PADDING, width: spot.width + SPOT_PADDING * 2, height: spot.height + SPOT_PADDING * 2 } : undefined}
        aria-hidden="true"
      />
      <div
        ref={bubble}
        className={`nd-tour-bubble is-${placement?.side ?? 'none'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nd-tour-title"
        aria-describedby="nd-tour-text"
        style={{ top: placement?.top ?? -9999, left: placement?.left ?? -9999, ['--nd-tour-arrow' as string]: `${placement?.arrow ?? 0}px` }}
      >
        <div className="nd-tour-head">
          <span className="nd-tour-count">{step.target ? t('tour.position', { current: position, total: counted.length }) : t('tour.eyebrow')}</span>
          {!last && <button type="button" className="ndc-text-button nd-tour-skip" onClick={onClose}>{t('tour.skip')}</button>}
        </div>
        <h2 id="nd-tour-title" className="nd-tour-title">{t(`tour.${step.id}.title`)}</h2>
        <p id="nd-tour-text" className="nd-tour-text">{t(`tour.${step.id}.text`, { done: t('pages.editor.done') })}</p>
        <div className="nd-tour-actions">
          {index > 0 && <button type="button" className="nd-btn" onClick={back}>{t('tour.back')}</button>}
          <button ref={primary} type="button" className="nd-btn nd-btn-accent" onClick={next}>
            {index === 0 ? t('tour.start') : last ? t('tour.done') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Starts the tour on the dashboard (Settings → Help). */
export function requestProductTour() {
  window.dispatchEvent(new Event('nasdash:tour'));
}
