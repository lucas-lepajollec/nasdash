import { defineWidget } from '../define';

export default defineWidget({
  type: 'quickstats', group: 'services', icon: '📊',
  nameKey: 'widget.quickstats.name', descriptionKey: 'widget.quickstats.description',
  access: { permission: 'quickstats' },
  settingsTab: 'widget-quickstats',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8, 12], default: 4, minPx: 150, h: 190 },
});
