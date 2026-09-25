import { defineWidget } from '../define';

export default defineWidget({
  type: 'metric-gpu', group: 'system', icon: '🎮',
  nameKey: 'widget.metricGpu.name', descriptionKey: 'widget.metricGpu.description',
  access: { permission: 'devices' },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8, 12, 16, 24], default: 6, minPx: 150, h: 220 },
});
