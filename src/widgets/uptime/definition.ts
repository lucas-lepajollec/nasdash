import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'uptime', group: 'network', icon: '📶',
  nameKey: 'widget.uptime.name', descriptionKey: 'widget.uptime.description',
  // Which services are up: viewers need their own permission.
  access: { permission: 'uptime' },
  // Every width, compact when narrow (the sizes policy in define.ts).
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 240 },
});
