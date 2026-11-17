import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'reading', group: 'media', icon: '📚',
  nameKey: 'widget.reading.name', descriptionKey: 'widget.reading.description',
  // What is being read, like the other media widgets.
  access: { permission: 'media' },
  // Every width, compact when narrow (the sizes policy in define.ts).
  sizes: { formats: ALL_WIDTHS, default: 8, minPx: 150, h: 300 },
});
