import { defineWidget } from '../define';

export default defineWidget({
  type: 'syncthing', group: 'system', icon: '🔄',
  nameKey: 'widget.syncthing.name', descriptionKey: 'widget.syncthing.description',
  // Folder and device names describe the network: viewers need their own permission.
  access: { permission: 'syncthing' },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12], default: 6, minPx: 180, h: 260 },
});
