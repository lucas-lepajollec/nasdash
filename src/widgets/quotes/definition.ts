import { defineWidget } from '../define';

export default defineWidget({
  type: 'quotes', group: 'content', icon: '❝',
  nameKey: 'widget.quotes.name', descriptionKey: 'widget.quotes.description',
  access: null, settingsTab: 'widget-quotes',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8, 12, 16, 24], default: 8, minPx: 150, h: 170 },
  defaultSettings: { rotation: 'day', style: 'literary' },
});
