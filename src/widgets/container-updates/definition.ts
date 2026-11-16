import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'container-updates', group: 'docker', icon: '📦',
  nameKey: 'widget.container-updates.name', descriptionKey: 'widget.container-updates.description',
  // Image names and versions describe the installation, like the container list.
  access: { permission: 'dockercontainers' },
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 240 },
});
