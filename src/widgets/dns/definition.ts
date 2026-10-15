import { defineWidget } from '../define';

export default defineWidget({
  type: 'dns', group: 'network', icon: '🛡️',
  nameKey: 'widget.dns.name', descriptionKey: 'widget.dns.description',
  // Client addresses and visited domains: viewers need their own permission.
  access: { permission: 'dns' }, settingsTab: 'widget-dns',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: [3, 4, 6, 8, 12, 16, 24], default: 8, minPx: 160, h: 360 },
  defaultSettings: { style: 'bars', sections: ['stats', 'history', 'top'] },
});
