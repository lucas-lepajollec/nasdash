import { defineWidget } from '../define';

export default defineWidget({
  type: 'spacer', group: 'layout', icon: '➖',
  nameKey: 'widget.spacer.name', descriptionKey: 'widget.spacer.description',
  access: null,
  // Kept for older configurations; the free grid leaves empty space by itself.
  internal: true,
  defaultSettings: { height: 120 },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8, 12, 18, 24], default: 24, minPx: 40, h: 120 },
});
