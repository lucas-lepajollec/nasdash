import { defineWidget } from '../define';

export default defineWidget({
  type: 'countdown', group: 'gadgets', icon: '⏱️',
  nameKey: 'widget.countdown.name', descriptionKey: 'widget.countdown.description',
  access: { permission: 'clock' },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8], default: 4, minPx: 150, h: 160 },
});
