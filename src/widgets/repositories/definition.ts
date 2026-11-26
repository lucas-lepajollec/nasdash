import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'repositories', group: 'services', icon: '📦',
  nameKey: 'widget.repositories.name', descriptionKey: 'widget.repositories.description',
  // What the service tells about the installation: viewers need their own permission.
  access: { permission: 'repositories' },
  // Every width, compact when narrow (the sizes policy in define.ts).
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 220 },
});
