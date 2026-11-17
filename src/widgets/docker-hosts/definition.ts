import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'docker-hosts', group: 'docker', icon: '🗄️',
  nameKey: 'widget.dockerHosts.name', descriptionKey: 'widget.dockerHosts.description',
  access: { requirement: { tabs: ['docker'], widgets: ['dockercontainers'] } },
  linkGroup: 'docker',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 190 },
});
