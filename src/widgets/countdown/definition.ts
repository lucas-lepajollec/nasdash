import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'countdown', group: 'gadgets', icon: '⏱️',
  nameKey: 'widget.countdown.name', descriptionKey: 'widget.countdown.description',
  access: { permission: 'clock' },
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 4, minPx: 150, h: 160 },
});
