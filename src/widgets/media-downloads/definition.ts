import { defineWidget } from '../define';

export default defineWidget({
  type: 'media-downloads', group: 'downloads', icon: '⬇️',
  nameKey: 'widget.media-downloads.name', descriptionKey: 'widget.media-downloads.description',
  // Part of the media stack: viewers need the Media permission.
  access: { permission: 'media' }, settingsTab: 'widget-downloads',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 6, minPx: 180, h: 220 },
  defaultSettings: {},
});
