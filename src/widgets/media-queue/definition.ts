import { defineWidget } from '../define';

export default defineWidget({
  type: 'media-queue', group: 'downloads', icon: '📥',
  nameKey: 'widget.media-queue.name', descriptionKey: 'widget.media-queue.description',
  // Part of the media stack: viewers need the Media permission.
  access: { permission: 'media' }, settingsTab: 'widget-arr',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 8, minPx: 180, h: 240 },
  defaultSettings: {},
});
