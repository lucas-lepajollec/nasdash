import { defineWidget } from '../define';

export default defineWidget({
  type: 'service-category', group: 'services', icon: '🗂️',
  nameKey: 'widget.serviceCategory.name', descriptionKey: 'widget.serviceCategory.description',
  access: null, settingsTab: 'widget-services',
  // Categories take any width (every column from 2 to 24), so they can line up
  // with any neighbour; width when added, smallest usable width (px) and
  // typical height (px) before measuring.
  sizes: { formats: Array.from({ length: 23 }, (_, i) => i + 2), default: 6, minPx: 150, h: 300 },
});
