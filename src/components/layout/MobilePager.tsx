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

/** How the page leaves, then how the next one arrives (see .nd-page-enter in mobile.css). */
const LEAVE_MS = 150;
const EASE = 'cubic-bezier(0.22, 0.9, 0.25, 1)';

/**
 * On a phone, a horizontal swipe on the page reaches the next or previous page.
 * The page follows the finger exactly (with some give at the first and last
 * page), then leaves on the side it was pushed to while the next one arrives
 * from the other side. `canStep` says whether there is a page that way,
 * `onStep` goes there.
 */
export function usePageSwipe(
  root: HTMLElement | null,
  { enabled, canStep, onStep }: { enabled: boolean; canStep: (direction: 1 | -1) => boolean; onStep: (direction: 1 | -1) => void },
) {
  const step = useRef(onStep);
  const can = useRef(canStep);
  useEffect(() => { step.current = onStep; can.current = canStep; });

  useEffect(() => {
    if (!root || !enabled) return;
    const media = window.matchMedia(MOBILE_QUERY);
    let start: { x: number; y: number; time: number } | null = null;
    let horizontal = false;
    let page: HTMLElement | null = null;
    let frame = 0;
    let leaving = false;

    const clear = (element: HTMLElement) => {
      element.style.transition = '';
      element.style.transform = '';
      element.style.opacity = '';
      element.style.willChange = '';
    };
    // Back in place, on a spring-like curve.
    const release = (element: HTMLElement | null, animate: boolean) => {
      if (!element) return;
      if (!animate) { clear(element); return; }
      element.style.transition = `transform 260ms ${EASE}, opacity 260ms ${EASE}`;
      element.style.transform = '';
      element.style.opacity = '';
      element.addEventListener('transitionend', () => clear(element), { once: true });
    };

    const onStart = (event: TouchEvent) => {
      start = null;
      horizontal = false;
      if (!media.matches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (leaving || touch.clientX < EDGE || touch.clientX > window.innerWidth - EDGE) return;
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
        if (page) { page.style.transition = ''; page.style.willChange = 'transform, opacity'; }
      }
      const element = page;
      if (!element) return;
      // One update per frame; past the first or last page the page only gives a little.
      const shift = can.current(dx < 0 ? 1 : -1) ? dx : dx * 0.3;
      const fade = 1 - Math.min(0.35, Math.abs(shift) / window.innerWidth * 0.5);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element.style.transform = `translate3d(${shift}px, 0, 0)`;
        element.style.opacity = String(fade);
      });
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
      cancelAnimationFrame(frame);
      // Finger to the left shows the next page, like turning a page.
      const direction = dx < 0 ? 1 : -1;
      if (!moved || !element || !can.current(direction)) { release(element, true); return; }
      // The page carries on the way it was pushed, faster with a flick, then the next one comes in.
      leaving = true;
      const width = window.innerWidth;
      const duration = Math.max(90, Math.min(LEAVE_MS, (width - Math.abs(dx)) / Math.max(speed, 1.2)));
      element.style.transition = `transform ${duration}ms ${EASE}, opacity ${duration}ms ${EASE}`;
      element.style.transform = `translate3d(${-direction * width * 0.45}px, 0, 0)`;
      element.style.opacity = '0';
      window.setTimeout(() => {
        leaving = false;
        step.current(direction);
        // Hidden by now (another page is shown): back to normal for next time.
        clear(element);
      }, duration);
    };

    const onCancel = () => {
      start = null;
      horizontal = false;
      cancelAnimationFrame(frame);
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
      cancelAnimationFrame(frame);
      release(page, false);
    };
  }, [root, enabled]);
}

/** Dots shown at most: beyond, they slide with the page shown. */
const MAX_DOTS = 7;

/**
 * Small dots at the bottom of a phone screen: where the current page sits
 * among the others. With many pages only seven show, following the page
 * shown; the outer ones get smaller when more pages lie beyond them.
 */
export function PageDots({ tabs, activeTab, onSwitch }: { tabs: TabDef[]; activeTab: TabId; onSwitch: (id: TabId) => void }) {
  const { t } = useI18n();
  if (tabs.length < 2) return null;
  const index = Math.max(0, tabs.findIndex(tab => tab.id === activeTab));
  const start = tabs.length > MAX_DOTS ? Math.min(Math.max(0, index - Math.floor(MAX_DOTS / 2)), tabs.length - MAX_DOTS) : 0;
  const end = Math.min(tabs.length, start + MAX_DOTS);
  const size = (position: number) => {
    const fromStart = start > 0 ? position - start : Infinity;
    const fromEnd = end < tabs.length ? end - 1 - position : Infinity;
    const edge = Math.min(fromStart, fromEnd);
    return edge === 0 ? 'is-far' : edge === 1 ? 'is-near' : '';
  };
  return (
    <nav className="nd-page-dots nd-glass" aria-label={t('mobile.pages')} data-tour="pages">
      {tabs.slice(start, end).map((tab, offset) => (
        <button
          key={tab.id}
          type="button"
          className={`nd-page-dot ${size(start + offset)}`}
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
