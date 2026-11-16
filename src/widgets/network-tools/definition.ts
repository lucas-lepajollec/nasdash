import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'network-tools', group: 'network', icon: '🔧',
  nameKey: 'widget.networkTools.name', descriptionKey: 'widget.networkTools.description',
  access: { requirement: { tabs: ['networks', 'docker'], widgets: ['dockercontainers'] } },
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 620 },
});
