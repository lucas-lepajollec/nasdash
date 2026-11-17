import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'media-indexers', group: 'downloads', icon: '🔎',
  nameKey: 'widget.media-indexers.name', descriptionKey: 'widget.media-indexers.description',
  // Part of the media stack: viewers need the Media permission.
  access: { permission: 'media' }, settingsTab: 'widget-arr',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 240 },
  defaultSettings: {},
});
