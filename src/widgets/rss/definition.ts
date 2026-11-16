import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'rss', group: 'content', icon: '📰',
  nameKey: 'widget.rss.name', descriptionKey: 'widget.rss.description',
  access: null, settingsTab: 'widget-rss',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 8, minPx: 150, h: 380 },
  defaultSettings: { display: 'list', grouping: 'merged', limit: 8, images: true, summaries: false },
});
