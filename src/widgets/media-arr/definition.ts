import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'media-arr', group: 'downloads', icon: '🧭',
  nameKey: 'widget.media-arr.name', descriptionKey: 'widget.media-arr.description',
  // Part of the media stack: viewers need the Media permission.
  access: { permission: 'media' }, settingsTab: 'widget-arr',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 12, minPx: 150, h: 200 },
  defaultSettings: {},
});
