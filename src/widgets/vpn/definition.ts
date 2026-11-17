import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'vpn', group: 'network', icon: '🔐',
  nameKey: 'widget.vpn.name', descriptionKey: 'widget.vpn.description',
  // The exit address and forwarded port describe the network: viewers need their own permission.
  access: { permission: 'vpn' },
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 200 },
});
