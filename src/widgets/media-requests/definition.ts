import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'media-requests', group: 'media', icon: '🎬',
  nameKey: 'widget.media-requests.name', descriptionKey: 'widget.media-requests.description',
  // Requests of the household, like the other media widgets.
  access: { permission: 'media' },
  // Every width, compact when narrow (the sizes policy in define.ts).
  sizes: { formats: ALL_WIDTHS, default: 8, minPx: 150, h: 300 },
});
