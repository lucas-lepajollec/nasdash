import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'networkgraph', group: 'network', icon: '📶',
  nameKey: 'widget.networkgraph.name', descriptionKey: 'widget.networkgraph.description',
  access: { permission: 'networkgraph' },
  settingsTab: 'widget-networkgraph',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 12, minPx: 150, h: 220 },
});
