import { defineWidget } from '../define';

export default defineWidget({
  type: 'music-playlists', group: 'music', icon: '🎶',
  nameKey: 'widget.music-playlists.name', descriptionKey: 'widget.music-playlists.description',
  access: { permission: 'media' }, settingsTab: 'widget-media',
  sizes: { formats: [4, 6, 8, 12, 16, 24], default: 8, minPx: 180, h: 300 },
  defaultSettings: {},
});
