import { describe, expect, it } from 'vitest';
import { getWidgetSizeBucket, RESPONSIVE_WIDGET_FORMATS } from './widgetSizing';
import { WIDGET_REGISTRY } from './widgetRegistry';

describe('existing responsive widget presentations', () => {
  it.each([
    [0, 'narrow'], [219, 'narrow'], [379.99, 'narrow'],
    [380, 'medium'], [719.99, 'medium'], [720, 'wide'], [1440, 'wide'],
    [NaN, 'narrow'], [Infinity, 'narrow'], [-1, 'narrow'],
  ])('preserves the presentation at width %s', (width, expected) => {
    expect(getWidgetSizeBucket(width as number)).toBe(expected);
  });

  it('declares supported formats on each existing definition without a second catalog', () => {
    expect(new Set(WIDGET_REGISTRY.map(widget => widget.id)).size).toBe(WIDGET_REGISTRY.length);
    for (const widget of WIDGET_REGISTRY) {
      expect(widget.responsiveFormats.length).toBeGreaterThan(0);
      expect(new Set(widget.responsiveFormats).size).toBe(widget.responsiveFormats.length);
      for (const format of widget.responsiveFormats) expect(RESPONSIVE_WIDGET_FORMATS).toContain(format);
    }
  });
});
