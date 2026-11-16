import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'dockercontainers', group: 'docker', icon: '🐳',
  nameKey: 'widget.dockercontainers.name', descriptionKey: 'widget.dockercontainers.description',
  access: { permission: 'dockercontainers' },
  settingsTab: 'widget-dockercontainers',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 320 },
});
