import { defineWidget } from '../define';

export default defineWidget({
  type: 'docker-hosts', group: 'docker', icon: '🗄️',
  nameKey: 'widget.dockerHosts.name', descriptionKey: 'widget.dockerHosts.description',
  access: { requirement: { tabs: ['docker'], widgets: ['dockercontainers'] } },
  linkGroup: 'docker',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12, 24], default: 6, minPx: 160, h: 110 },
});
