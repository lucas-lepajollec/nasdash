import { defineWidget } from '../define';

export default defineWidget({
  type: 'media-recent', group: 'media', icon: '🍿',
  nameKey: 'widget.media-recent.name', descriptionKey: 'widget.media-recent.description',
  // What a household watches: viewers need the Media permission.
  access: { permission: 'media' }, settingsTab: 'widget-media',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 12, minPx: 180, h: 300 },
  defaultSettings: {},
});
