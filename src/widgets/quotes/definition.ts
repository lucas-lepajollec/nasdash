import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'quotes', group: 'content', icon: '❝',
  nameKey: 'widget.quotes.name', descriptionKey: 'widget.quotes.description',
  access: null, settingsTab: 'widget-quotes',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 8, minPx: 150, h: 170 },
  defaultSettings: { rotation: 'day', style: 'literary' },
});
