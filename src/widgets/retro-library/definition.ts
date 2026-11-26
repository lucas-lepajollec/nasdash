import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'retro-library', group: 'media', icon: '🕹️',
  nameKey: 'widget.retro-library.name', descriptionKey: 'widget.retro-library.description',
  // A media library: viewers need the Media permission, like the reading widget.
  access: { permission: 'media' },
  // Every width, compact when narrow (the sizes policy in define.ts).
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 220 },
});
