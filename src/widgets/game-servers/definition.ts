import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'game-servers', group: 'media', icon: '🎮',
  nameKey: 'widget.game-servers.name', descriptionKey: 'widget.game-servers.description',
  // What the service tells about the installation: viewers need their own permission.
  access: { permission: 'game-servers' },
  // Every width, compact when narrow (the sizes policy in define.ts).
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 220 },
});
