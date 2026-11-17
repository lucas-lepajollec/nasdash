import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'music-recent', group: 'music', icon: '💿',
  nameKey: 'widget.music-recent.name', descriptionKey: 'widget.music-recent.description',
  access: { permission: 'media' }, settingsTab: 'widget-media',
  sizes: { formats: ALL_WIDTHS, default: 12, minPx: 150, h: 300 },
  defaultSettings: {},
});
