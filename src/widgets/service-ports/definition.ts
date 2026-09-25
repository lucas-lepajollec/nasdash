import { defineWidget } from '../define';

export default defineWidget({
  type: 'service-ports', group: 'services', icon: '🔌',
  nameKey: 'widget.servicePorts.name', descriptionKey: 'widget.servicePorts.description',
  access: null, settingsTab: 'widget-services',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [6, 12, 18, 24], default: 24, minPx: 200, h: 90 },
});
