import { defineWidget } from '../define';

export default defineWidget({
  type: 'networkgraph', group: 'network', icon: '📶',
  nameKey: 'widget.networkgraph.name', descriptionKey: 'widget.networkgraph.description',
  access: { permission: 'networkgraph' },
  settingsTab: 'widget-networkgraph',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12, 18, 24], default: 12, minPx: 260, h: 220 },
});
