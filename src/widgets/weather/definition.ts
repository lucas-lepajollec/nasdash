import { defineWidget } from '../define';

export default defineWidget({
  type: 'weather', group: 'gadgets', icon: '☁️',
  nameKey: 'widget.weather.name', descriptionKey: 'widget.weather.description',
  access: { permission: 'weather' }, settingsTab: 'widget-weather',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8], default: 6, minPx: 170, h: 300 },
});
