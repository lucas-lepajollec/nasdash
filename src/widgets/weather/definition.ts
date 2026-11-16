import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'weather', group: 'gadgets', icon: '☁️',
  nameKey: 'widget.weather.name', descriptionKey: 'widget.weather.description',
  access: { permission: 'weather' }, settingsTab: 'widget-weather',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 300 },
});
