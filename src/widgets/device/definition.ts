import { defineWidget } from '../define';

export default defineWidget({
  type: 'device', group: 'system', icon: '💻',
  nameKey: 'widget.device.name', descriptionKey: 'widget.device.description',
  access: { permission: 'devices' },
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8, 12], default: 6, minPx: 150, h: 480 },
});
