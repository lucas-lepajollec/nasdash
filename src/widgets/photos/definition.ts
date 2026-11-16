import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'photos', group: 'content', icon: '🖼️',
  nameKey: 'widget.photos.name', descriptionKey: 'widget.photos.description',
  // Personal photos: viewers need their own permission.
  access: { permission: 'photos' }, settingsTab: 'widget-photos',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 8, minPx: 150, h: 300 },
  defaultSettings: { display: 'slideshow', mode: 'random', count: 12 },
});
