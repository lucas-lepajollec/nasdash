import { defineWidget } from '../define';

export default defineWidget({
  type: 'music-library', group: 'music', icon: '🎼',
  nameKey: 'widget.music-library.name', descriptionKey: 'widget.music-library.description',
  access: { permission: 'media' }, settingsTab: 'widget-media',
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 6, minPx: 180, h: 200 },
  defaultSettings: {},
});
