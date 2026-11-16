import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'tailscale', group: 'network', icon: '🔒',
  nameKey: 'widget.tailscale.name', descriptionKey: 'widget.tailscale.description',
  access: { permission: 'tailscale' },
  settingsTab: 'widget-tailscale',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 300 },
});
