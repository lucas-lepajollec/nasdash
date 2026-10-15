import { defineWidget } from '../define';

export default defineWidget({
  type: 'rss', group: 'content', icon: '📰',
  nameKey: 'widget.rss.name', descriptionKey: 'widget.rss.description',
  access: null, settingsTab: 'widget-rss',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8, 12, 16, 24], default: 8, minPx: 160, h: 380 },
  defaultSettings: { display: 'list', grouping: 'merged', limit: 8, images: true, summaries: false },
});
