import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'syncthing', group: 'system', icon: '🔄',
  nameKey: 'widget.syncthing.name', descriptionKey: 'widget.syncthing.description',
  // Folder and device names describe the network: viewers need their own permission.
  access: { permission: 'syncthing' },
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 260 },
});
