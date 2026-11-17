import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'media-recent', group: 'media', icon: '🍿',
  nameKey: 'widget.media-recent.name', descriptionKey: 'widget.media-recent.description',
  // What a household watches: viewers need the Media permission.
  access: { permission: 'media' }, settingsTab: 'widget-media',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 12, minPx: 150, h: 300 },
  defaultSettings: {},
});
