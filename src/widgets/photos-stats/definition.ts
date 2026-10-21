import { defineWidget } from '../define';
export default defineWidget({
  type: 'photos-stats', group: 'content', icon: '📷',
  nameKey: 'widget.photos-stats.name', descriptionKey: 'widget.photos-stats.description',
  access: { permission: 'photos' }, settingsTab: 'widget-photos',
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 6, minPx: 180, h: 160 },
  defaultSettings: {},
});
