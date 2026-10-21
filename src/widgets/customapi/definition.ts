import { defineWidget } from '../define';

export default defineWidget({
  type: 'customapi', group: 'content', icon: '🧩',
  nameKey: 'widget.customapi.name', descriptionKey: 'widget.customapi.description',
  // An API can say anything about the lab: viewers need their own permission.
  access: { permission: 'customapi' }, settingsTab: 'widget-customapi',
  // Its settings may still change shape: marked as experimental.
  experimental: true,
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8, 12, 16, 24], default: 6, minPx: 140, h: 180 },
  defaultSettings: { display: 'figures', refresh: 60 },
});
