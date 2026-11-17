import { ALL_WIDTHS, defineWidget } from '../define';
export default defineWidget({
  type: 'photos-stats', group: 'content', icon: '📷',
  nameKey: 'widget.photos-stats.name', descriptionKey: 'widget.photos-stats.description',
  access: { permission: 'photos' }, settingsTab: 'widget-photos',
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 160 },
  defaultSettings: {},
});
