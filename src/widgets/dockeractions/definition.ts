import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'dockeractions', group: 'docker', icon: '⚡',
  nameKey: 'widget.dockeractions.name', descriptionKey: 'widget.dockeractions.description',
  access: { permission: 'dockeractions' },
  settingsTab: 'widget-dockeractions',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 200 },
});
