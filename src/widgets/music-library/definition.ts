import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'music-library', group: 'music', icon: '🎼',
  nameKey: 'widget.music-library.name', descriptionKey: 'widget.music-library.description',
  access: { permission: 'media' }, settingsTab: 'widget-media',
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 200 },
  defaultSettings: {},
});
