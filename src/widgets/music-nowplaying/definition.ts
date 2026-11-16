import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'music-nowplaying', group: 'music', icon: '🎵',
  nameKey: 'widget.music-nowplaying.name', descriptionKey: 'widget.music-nowplaying.description',
  access: { permission: 'media' }, settingsTab: 'widget-media',
  sizes: { formats: ALL_WIDTHS, default: 8, minPx: 150, h: 240 },
  defaultSettings: {},
});
