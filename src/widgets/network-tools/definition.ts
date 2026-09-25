import { defineWidget } from '../define';

export default defineWidget({
  type: 'network-tools', group: 'network', icon: '🔧',
  nameKey: 'widget.networkTools.name', descriptionKey: 'widget.networkTools.description',
  access: { requirement: { tabs: ['networks', 'docker'], widgets: ['dockercontainers'] } },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8], default: 6, minPx: 190, h: 620 },
});
