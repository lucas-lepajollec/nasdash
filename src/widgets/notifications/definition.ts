import { ALL_WIDTHS, defineWidget } from '../define';

export default defineWidget({
  type: 'notifications', group: 'content', icon: '🔔',
  nameKey: 'widget.notifications.name', descriptionKey: 'widget.notifications.description',
  // Notifications may say anything: viewers need their own permission.
  access: { permission: 'notifications' },
  // Every width, compact when narrow (the sizes policy in define.ts).
  sizes: { formats: ALL_WIDTHS, default: 6, minPx: 150, h: 280 },
});
