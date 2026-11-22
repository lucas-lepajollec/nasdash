'use client';

import { createContext, useContext, useLayoutEffect, useRef } from 'react';

/**
 * Widgets that take the width of their content (the page buttons): the page
 * hears the width the content needs and gives the widget just enough columns,
 * keeping the side it is aligned to (see `fitWidths` in PageView).
 */
export const WidgetFitContext = createContext<((px: number) => void) | null>(null);

/**
 * Reports the width `row` needs. Only `shrinking` may give way (a name cut
 * with an ellipsis): its full width is counted, so a narrow widget can grow
 * back to show it whole.
 */
export function useFitWidth<Row extends HTMLElement, Shrinking extends HTMLElement>() {
  const report = useContext(WidgetFitContext);
  const row = useRef<Row>(null);
  const shrinking = useRef<Shrinking>(null);
  useLayoutEffect(() => {
    const node = row.current;
    if (!report || !node) return;
    let last = 0;
    const check = () => {
      const cut = shrinking.current;
      // Up to its own maximum width (a long name is cut anyway).
      const max = cut ? parseFloat(getComputedStyle(cut).maxWidth) : NaN;
      const hidden = cut ? Math.max(0, Math.min(cut.scrollWidth, Number.isFinite(max) ? max : Infinity) - cut.clientWidth) : 0;
      const px = Math.ceil(node.getBoundingClientRect().width + hidden);
      if (px > 0 && Math.abs(px - last) >= 1) { last = px; report(px); }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(node);
    if (shrinking.current) observer.observe(shrinking.current);
    return () => observer.disconnect();
  });
  return { row, shrinking };
}
