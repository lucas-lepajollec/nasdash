import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'clock', group: 'gadgets', icon: '🕒',
  nameKey: 'widget.clock.name', descriptionKey: 'widget.clock.description',
  access: { permission: 'clock' }, settingsTab: 'widget-clock',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 4, minPx: 150, h: 170 },
});
