import { defineWidget } from '../define';

export default defineWidget({
  type: 'webpage', group: 'content', icon: '🌐',
  nameKey: 'widget.webpage.name', descriptionKey: 'widget.webpage.description',
  // The address and what the page shows are chosen by an administrator: viewers need their own permission.
  access: { permission: 'webpage' },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [6, 8, 12, 16, 24], default: 12, minPx: 240, h: 400 },
});
