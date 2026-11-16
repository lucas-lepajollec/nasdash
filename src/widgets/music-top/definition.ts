import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'music-top', group: 'music', icon: '🏆',
  nameKey: 'widget.music-top.name', descriptionKey: 'widget.music-top.description',
  access: { permission: 'media' }, settingsTab: 'widget-media',
  sizes: { formats: ALL_WIDTHS, default: 8, minPx: 150, h: 300 },
  defaultSettings: {},
});
