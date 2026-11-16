import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'notes', group: 'gadgets', icon: '📝',
  nameKey: 'widget.notes.name', descriptionKey: 'widget.notes.description',
  // What is written there may be private: viewers need their own permission.
  access: { permission: 'notes' },
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 180 },
});
