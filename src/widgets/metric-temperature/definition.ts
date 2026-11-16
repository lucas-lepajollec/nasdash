import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'metric-temperature', group: 'system', icon: '🌡️',
  nameKey: 'widget.metricTemperature.name', descriptionKey: 'widget.metricTemperature.description',
  access: { permission: 'devices' },
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 220 },
});
