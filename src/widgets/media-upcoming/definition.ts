import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'media-upcoming', group: 'media', icon: '📅',
  nameKey: 'widget.media-upcoming.name', descriptionKey: 'widget.media-upcoming.description',
  // Part of the media stack: viewers need the Media permission.
  access: { permission: 'media' }, settingsTab: 'widget-arr',
  // Its sources and matching are still being refined: marked as experimental.
  experimental: true,
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 12, minPx: 150, h: 300 },
  defaultSettings: {},
});
