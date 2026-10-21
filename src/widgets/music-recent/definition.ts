import { defineWidget } from '../define';

export default defineWidget({
  type: 'music-recent', group: 'music', icon: '💿',
  nameKey: 'widget.music-recent.name', descriptionKey: 'widget.music-recent.description',
  access: { permission: 'media' }, settingsTab: 'widget-media',
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 12, minPx: 180, h: 300 },
  defaultSettings: {},
});
