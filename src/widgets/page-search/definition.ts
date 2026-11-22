import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'page-search', group: 'layout', icon: '🔎',
  nameKey: 'widget.page-search.name', descriptionKey: 'widget.page-search.description',
  access: null,
  // Every width from a quarter of a phone; width when added, smallest usable
  // width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 140, h: 36 },
});
