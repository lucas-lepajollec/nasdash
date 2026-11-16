import { defineWidget, WIDE_WIDTHS } from '../define';

export default defineWidget({
  type: 'docker-explorer', group: 'docker', icon: '🔎',
  nameKey: 'widget.dockerExplorer.name', descriptionKey: 'widget.dockerExplorer.description',
  access: { requirement: { tabs: ['docker'] } },
  linkGroup: 'docker',
  // Widths it can be resized to (columns out of 24), width when added,
  // smallest usable width (px) and typical height (px) before measuring.
  sizes: { formats: WIDE_WIDTHS, default: 18, minPx: 420, h: 640 },
});
