import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'retro-library', group: 'media', icon: '🕹️',
  nameKey: 'widget.retro-library.name', descriptionKey: 'widget.retro-library.description',
  // What the service tells about the installation: viewers need their own permission.
  access: { permission: 'retro-library' },
  // Every width, compact when narrow (the sizes policy in define.ts).
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 220 },
});
