import { defineWidget } from '../define';

export default defineWidget({
  type: 'calendar', group: 'gadgets', icon: '📅',
  nameKey: 'widget.calendar.name', descriptionKey: 'widget.calendar.description',
  access: { permission: 'calendar' }, settingsTab: 'widget-calendar',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8], default: 6, minPx: 200, h: 330 },
});
