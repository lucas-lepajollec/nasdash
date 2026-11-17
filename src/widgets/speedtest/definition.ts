import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'speedtest', group: 'network', icon: '📶',
  nameKey: 'widget.speedtest.name', descriptionKey: 'widget.speedtest.description',
  access: { permission: 'speedtest' },
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 220 },
});
