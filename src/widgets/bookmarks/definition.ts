import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'bookmarks', group: 'content', icon: '🔖',
  nameKey: 'widget.bookmarks.name', descriptionKey: 'widget.bookmarks.description',
  access: null, settingsTab: 'widget-bookmarks',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 140, h: 320 },
  defaultSettings: { display: 'tree' },
});
