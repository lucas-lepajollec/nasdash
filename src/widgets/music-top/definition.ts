import { defineWidget } from '../define';

export default defineWidget({
  type: 'music-top', group: 'music', icon: '🏆',
  nameKey: 'widget.music-top.name', descriptionKey: 'widget.music-top.description',
  access: { permission: 'media' }, settingsTab: 'widget-media',
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 8, minPx: 180, h: 300 },
  defaultSettings: {},
});
