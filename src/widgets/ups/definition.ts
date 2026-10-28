import { defineWidget } from '../define';

export default defineWidget({
  type: 'ups', group: 'system', icon: '🔋',
  nameKey: 'widget.ups.name', descriptionKey: 'widget.ups.description',
  access: { permission: 'ups' },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8, 12], default: 6, minPx: 160, h: 220 },
});
