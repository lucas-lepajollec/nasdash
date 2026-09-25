import { defineWidget } from '../define';

export default defineWidget({
  type: 'tailscale', group: 'network', icon: '🔒',
  nameKey: 'widget.tailscale.name', descriptionKey: 'widget.tailscale.description',
  access: { permission: 'tailscale' },
  settingsTab: 'widget-tailscale',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [4, 6, 8, 12], default: 6, minPx: 190, h: 300 },
});
