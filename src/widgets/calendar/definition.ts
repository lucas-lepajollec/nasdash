import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'calendar', group: 'gadgets', icon: '📅',
  nameKey: 'widget.calendar.name', descriptionKey: 'widget.calendar.description',
  access: { permission: 'calendar' }, settingsTab: 'widget-calendar',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 330 },
});
