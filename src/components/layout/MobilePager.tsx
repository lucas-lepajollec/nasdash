'use client';

import { useEffect, useRef } from 'react';
import type { TabDef, TabId } from '@/hooks/useTabs';
import { useI18n } from '@/i18n/I18nProvider';

/** Screens where the header becomes the phone header: large page title, search and menu buttons. */
export const MOBILE_QUERY = '(max-width: 960px)';

/** Touches this close to a screen edge belong to the system (Safari's back gesture). */
const EDGE = 24;
/** Movement before deciding whether a touch is a horizontal swipe or a scroll. */
const DECIDE = 10;
/** Distance, or a quick flick, that turns a swipe into a page change. */
const DISTANCE = 72;
const FLICK_DISTANCE = 32;
const FLICK_SPEED = 0.45;

/** Elements that use horizontal movement themselves: fields, charts, drag handles and horizontal scrollers. */
function usesHorizontalMovement(target: EventTarget | null, root: HTMLElement): boolean {
  let node = target instanceof Element ? target : null;
  if (node?.closest('input, textarea, select, [contenteditable="true"], .ndc-chart, [data-no-swipe]')) return true;
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      const style = window.getComputedStyle(node);
      if (style.touchAction === 'none') return true;
      if (node.scrollWidth > node.clientWidth + 1 && /(auto|scroll)/.test(style.overflowX)) return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * On a phone, a horizontal swipe on the page reaches the next or previous page.
 * The page follows the finger a little, then `onStep` decides: it returns false at the first or last page.
 */
export function usePageSwipe(
  root: HTMLElement | null,
  { enabled, onStep }: { enabled: boolean; onStep: (direction: 1 | -1) => boolean },
) {
  const step = useRef(onStep);
  useEffect(() => { step.current = onStep; });

  useEffect(() => {
    if (!root || !enabled) return;
    const media = window.matchMedia(MOBILE_QUERY);
    let start: { x: number; y: number; time: number } | null = null;
    let horizontal = false;
    let page: HTMLElement | null = null;

    const release = (element: HTMLElement | null, animate: boolean) => {
      if (!element) return;
      element.style.transition = animate ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' : '';
      element.style.transform = '';
      if (animate) element.addEventListener('transitionend', () => { element.style.transition = ''; }, { once: true });
    };

    const onStart = (event: TouchEvent) => {
      start = null;
      horizontal = false;
      if (!media.matches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX < EDGE || touch.clientX > window.innerWidth - EDGE) return;
      if (usesHorizontalMovement(event.target, root)) return;
      start = { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
    };

    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!horizontal) {
        if (Math.abs(dx) < DECIDE && Math.abs(dy) < DECIDE) return;
        // A mostly vertical movement is a scroll: let it be.
        if (Math.abs(dx) < Math.abs(dy) * 1.3) { start = null; return; }
        horizontal = true;
        page = root.querySelector<HTMLElement>(':scope > [data-active="true"]');
        if (page) page.style.transition = '';
      }
      if (page) page.style.transform = `translateX(${dx * 0.35}px)`;
    };

    const onEnd = (event: TouchEvent) => {
      const from = start;
      start = null;
      if (!from || !horizontal) return;
      horizontal = false;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - from.x;
      const speed = Math.abs(dx) / Math.max(1, event.timeStamp - from.time);
      const moved = Math.abs(dx) >= DISTANCE || (Math.abs(dx) >= FLICK_DISTANCE && speed >= FLICK_SPEED);
      const element = page;
      page = null;
      // Finger to the left shows the next page, like turning a page.
      const switched = moved && step.current(dx < 0 ? 1 : -1);
      release(element, !switched);
    };

    const onCancel = () => {
      start = null;
      horizontal = false;
      release(page, true);
      page = null;
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: true });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onCancel);
      release(page, false);
    };
  }, [root, enabled]);
}

/** Small dots at the bottom of a phone screen: where the current page sits among the others. */
export function PageDots({ tabs, activeTab, onSwitch }: { tabs: TabDef[]; activeTab: TabId; onSwitch: (id: TabId) => void }) {
  const { t } = useI18n();
  if (tabs.length < 2) return null;
  return (
    <nav className="nd-page-dots nd-glass" aria-label={t('mobile.pages')} data-tour="pages">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          className="nd-page-dot"
          aria-label={t(tab.name)}
          aria-current={tab.id === activeTab ? 'page' : undefined}
          onClick={() => onSwitch(tab.id)}
        >
          <span aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
