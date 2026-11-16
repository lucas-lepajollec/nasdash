import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'devices', group: 'system', icon: '🖥️',
  nameKey: 'widget.devices.name', descriptionKey: 'widget.devices.description',
  access: { permission: 'devices' },
  settingsTab: 'widget-devices',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 360 },
});
