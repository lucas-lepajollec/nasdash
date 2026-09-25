/** Existing container-width presentations, not fixed widget heights or grid units. */
export const WIDGET_SIZE_BREAKPOINTS = { medium: 380, wide: 720 } as const;
export const RESPONSIVE_WIDGET_FORMATS = ['narrow', 'medium', 'wide'] as const;
export type WidgetSizeBucket = typeof RESPONSIVE_WIDGET_FORMATS[number];

/** Shared by the live renderer and future layout/editor adapters. */
export function getWidgetSizeBucket(width: number): WidgetSizeBucket {
  if (!Number.isFinite(width) || width < 0) return 'narrow';
  if (width >= WIDGET_SIZE_BREAKPOINTS.wide) return 'wide';
  if (width >= WIDGET_SIZE_BREAKPOINTS.medium) return 'medium';
  return 'narrow';
}
