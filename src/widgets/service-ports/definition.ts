import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'service-ports', group: 'services', icon: '🔌',
  nameKey: 'widget.servicePorts.name', descriptionKey: 'widget.servicePorts.description',
  access: null, settingsTab: 'widget-services',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 24, minPx: 80, h: 90 },
});
