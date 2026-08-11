'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

/**
 * Gives a modal dialog predictable keyboard behavior without changing its
 * business actions: initial focus, Escape handling, focus trapping and focus
 * restoration. Only the top-most dialog reacts when dialogs are nested.
 */
export function useDialogAccessibility(
  onClose: () => void,
  isOpen = true,
  restoreFocus?: () => HTMLElement | null,
) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const restoreFocusRef = useRef(restoreFocus);

  useEffect(() => {
    onCloseRef.current = onClose;
    restoreFocusRef.current = restoreFocus;
  }, [onClose, restoreFocus]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const isTopMostDialog = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'));
      return dialogs.at(-1) === dialog;
    };

    const focusableElements = () => Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(isVisible);

    const animationFrame = window.requestAnimationFrame(() => {
      const autofocusTarget = dialog.querySelector<HTMLElement>('[data-dialog-autofocus]');
      const target = autofocusTarget && isVisible(autofocusTarget)
        ? autofocusTarget
        : focusableElements()[0] ?? dialog;
      target.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopMostDialog()) return;

      if (event.key === 'Escape') {
        if (
          event.target instanceof Element
          && event.target.closest('[data-dialog-escape-boundary="true"]')
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      const focusTarget = restoreFocusRef.current?.() ?? previouslyFocused;
      if (focusTarget?.isConnected) {
        focusTarget.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  return dialogRef;
}
