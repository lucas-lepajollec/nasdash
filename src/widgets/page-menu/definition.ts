import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'page-menu', group: 'layout', icon: '🧭',
  nameKey: 'widget.page-menu.name', descriptionKey: 'widget.page-menu.description',
  access: null,
  // Required on every page (src/lib/pages/header.ts); it keeps the width it was placed with.
  fixedWidth: true,
  defaultSettings: { align: 'center' },
  sizes: { formats: ALL_WIDTHS, default: 12, minPx: 120, h: 36 },
});
