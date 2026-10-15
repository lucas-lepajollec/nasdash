import { defineWidget } from '../define';

export default defineWidget({
  type: 'photos', group: 'content', icon: '🖼️',
  nameKey: 'widget.photos.name', descriptionKey: 'widget.photos.description',
  // Personal photos: viewers need their own permission.
  access: { permission: 'photos' }, settingsTab: 'widget-photos',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8, 12, 16, 24], default: 8, minPx: 160, h: 300 },
  defaultSettings: { display: 'slideshow', mode: 'random', count: 12 },
});
