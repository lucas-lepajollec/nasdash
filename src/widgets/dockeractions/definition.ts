import { defineWidget } from '../define';

export default defineWidget({
  type: 'dockeractions', group: 'docker', icon: '⚡',
  nameKey: 'widget.dockeractions.name', descriptionKey: 'widget.dockeractions.description',
  access: { permission: 'dockeractions' },
  settingsTab: 'widget-dockeractions',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12], default: 6, minPx: 160, h: 200 },
});
