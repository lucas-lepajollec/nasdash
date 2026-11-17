import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'markets', group: 'content', icon: '📈',
  nameKey: 'widget.markets.name', descriptionKey: 'widget.markets.description',
  access: null, settingsTab: 'widget-markets',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 300 },
  defaultSettings: { range: '1d', display: 'list' },
});
