import { defineWidget } from '../define';

export default defineWidget({
  type: 'network-topology', group: 'network', icon: '🗺️',
  nameKey: 'widget.networkTopology.name', descriptionKey: 'widget.networkTopology.description',
  maxInstances: 1,
  access: { requirement: { tabs: ['networks'], widgets: ['networkgraph'] } }, settingsTab: 'widget-topology',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [12, 16, 18, 20, 24], default: 18, minPx: 420, h: 760 },
});
