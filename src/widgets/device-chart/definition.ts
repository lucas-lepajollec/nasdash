import { defineWidget } from '../define';

export default defineWidget({
  type: 'device-chart', group: 'system', icon: '📈',
  nameKey: 'widget.deviceChart.name', descriptionKey: 'widget.deviceChart.description',
  access: { permission: 'devices' },
  // Covered by the one-measure widgets drawn as charts: kept for pages that have one.
  internal: true,
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [6, 8, 12, 16, 24], default: 12, minPx: 300, h: 260 },
});
