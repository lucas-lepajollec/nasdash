import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'media-downloads', group: 'downloads', icon: '⬇️',
  nameKey: 'widget.media-downloads.name', descriptionKey: 'widget.media-downloads.description',
  // Part of the media stack: viewers need the Media permission.
  access: { permission: 'media' }, settingsTab: 'widget-downloads',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 220 },
  defaultSettings: {},
});
