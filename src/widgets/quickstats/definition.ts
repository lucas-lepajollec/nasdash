import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'quickstats', group: 'services', icon: '📊',
  nameKey: 'widget.quickstats.name', descriptionKey: 'widget.quickstats.description',
  access: { permission: 'quickstats' },
  settingsTab: 'widget-quickstats',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 4, minPx: 150, h: 190 },
});
