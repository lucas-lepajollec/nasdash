import { defineWidget } from '../define';

export default defineWidget({
  type: 'music-nowplaying', group: 'music', icon: '🎵',
  nameKey: 'widget.music-nowplaying.name', descriptionKey: 'widget.music-nowplaying.description',
  access: { permission: 'media' }, settingsTab: 'widget-media',
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 8, minPx: 180, h: 240 },
  defaultSettings: {},
});
