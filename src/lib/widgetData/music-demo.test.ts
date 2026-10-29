import { expect, it } from 'vitest';
import config from '../../../demo/fixtures/config.json';
import pages from '../../../demo/fixtures/pages.json';
import { getWidgetCatalogEntry, WIDGET_GROUP_ORDER } from '@/lib/widgets/catalog';
import { MUSIC_WIDGET_TYPES } from './music';

it('registers every music widget with media permissions and shows each on the demo Music page', () => {
  const source = config.integrations.find(instance => instance.type === 'navidrome');
  expect(source).toMatchObject({ id: 'navidrome-demo', settings: { url: 'https://music.demo.invalid' } });
  expect(source).not.toHaveProperty('secrets');
  const page = pages.pages.find(page => page.id === 'music')!;
  const all: Array<{ type: string; settings: object }> = pages.pages.flatMap(page => page.widgets as Array<{ type: string; settings: object }>);
  const music = all.filter(widget => widget.type.startsWith('music-'));
  expect(WIDGET_GROUP_ORDER.indexOf('music')).toBe(WIDGET_GROUP_ORDER.indexOf('media') + 1);
  for (const type of MUSIC_WIDGET_TYPES) {
    const definition = getWidgetCatalogEntry(type)!;
    expect(definition).toMatchObject({ group: 'music', access: { permission: 'media' } });
    const widget = page.widgets.find(widget => widget.type === type)!;
    expect(widget.settings).toMatchObject({ integrationId: source!.id });
  }
  for (const widget of music) expect(widget.settings).toMatchObject({ integrationId: source!.id });
});
