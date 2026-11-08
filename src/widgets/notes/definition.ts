import { defineWidget } from '../define';

export default defineWidget({
  type: 'notes', group: 'gadgets', icon: '📝',
  nameKey: 'widget.notes.name', descriptionKey: 'widget.notes.description',
  // What is written there may be private: viewers need their own permission.
  access: { permission: 'notes' },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 6, minPx: 160, h: 180 },
});
