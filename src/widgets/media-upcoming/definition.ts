import { defineWidget } from '../define';

export default defineWidget({
  type: 'media-upcoming', group: 'media', icon: '📅',
  nameKey: 'widget.media-upcoming.name', descriptionKey: 'widget.media-upcoming.description',
  // Part of the media stack: viewers need the Media permission.
  access: { permission: 'media' }, settingsTab: 'widget-arr',
  // Its sources and matching are still being refined: marked as experimental.
  experimental: true,
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 12, minPx: 180, h: 300 },
  defaultSettings: {},
});
