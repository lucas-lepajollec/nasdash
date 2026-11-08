import { defineWidget } from '../define';

export default defineWidget({
  type: 'speedtest', group: 'network', icon: '📶',
  nameKey: 'widget.speedtest.name', descriptionKey: 'widget.speedtest.description',
  access: { permission: 'speedtest' },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12], default: 6, minPx: 180, h: 220 },
});
