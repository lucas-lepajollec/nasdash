import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'page-actions', group: 'layout', icon: '⚙️',
  nameKey: 'widget.page-actions.name', descriptionKey: 'widget.page-actions.description',
  access: null,
  // Required on every page (src/lib/pages/header.ts); it keeps the width it was placed with.
  fixedWidth: true,
  // One set of buttons per page (several searches and menus are fine).
  maxPerPage: 1,
  defaultSettings: { align: 'end' },
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 120, h: 36 },
});
