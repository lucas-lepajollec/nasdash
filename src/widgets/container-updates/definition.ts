import { defineWidget } from '../define';

export default defineWidget({
  type: 'container-updates', group: 'docker', icon: '📦',
  nameKey: 'widget.container-updates.name', descriptionKey: 'widget.container-updates.description',
  // Image names and versions describe the installation, like the container list.
  access: { permission: 'dockercontainers' },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12], default: 6, minPx: 180, h: 240 },
});
