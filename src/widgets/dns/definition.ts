import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'dns', group: 'network', icon: '🛡️',
  nameKey: 'widget.dns.name', descriptionKey: 'widget.dns.description',
  // Client addresses and visited domains: viewers need their own permission.
  access: { permission: 'dns' }, settingsTab: 'widget-dns',
  // Every width, compact when narrow (the sizes policy in define.ts); width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: ALL_WIDTHS, default: 8, minPx: 150, h: 360 },
  defaultSettings: { style: 'bars', sections: ['stats', 'history', 'top'] },
});
