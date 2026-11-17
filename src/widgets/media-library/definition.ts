import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'media-library', group: 'media', icon: '📚',
  nameKey: 'widget.media-library.name', descriptionKey: 'widget.media-library.description',
  // What a household watches: viewers need the Media permission.
  access: { permission: 'media' }, settingsTab: 'widget-media',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 160 },
  defaultSettings: {},
});
