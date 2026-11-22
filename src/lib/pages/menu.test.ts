import { describe, expect, it } from 'vitest';
import { itemPages, menuItems, readMenuSettings, resolveMenuSettings } from './menu';

const tabs = ['home', 'machines', 'docker', 'network', 'media', 'music'].map(id => ({ id }));

describe('resolveMenuSettings', () => {
  it('uses the shared settings for every menu', () => {
    const shared = { style: 'pill', icons: true, perRow: 3, maxPages: 4, align: 'start' };
    expect(resolveMenuSettings({}, shared)).toMatchObject({ style: 'pill', icons: true, perRow: 3, maxPages: 4, align: 'start' });
  });

  it('keeps an upgraded menu as it was until shared values are saved', () => {
    expect(resolveMenuSettings({ align: 'end', icons: true }, undefined)).toMatchObject({ style: 'tabs', align: 'end', icons: true });
    expect(resolveMenuSettings({ align: 'end' }, { align: 'center' }).align).toBe('center');
  });

  it('lets a menu keep its own settings', () => {
    const shared = { style: 'pill', align: 'center', groups: [{ id: 'a', name: 'A', pages: ['home'] }] };
    const own = { ownSettings: true, style: 'icons', align: 'end', groups: [] };
    expect(resolveMenuSettings(own, shared)).toMatchObject({ style: 'icons', align: 'end', groups: [] });
  });

  it('reads 0 as "all" and "as many as fit", over a fallback', () => {
    expect(resolveMenuSettings({ perRow: 3 }, { perRow: 0, maxPages: 0 })).toMatchObject({ perRow: undefined, maxPages: undefined });
  });

  it('falls back to the former global icons setting', () => {
    expect(resolveMenuSettings({}, undefined, true).icons).toBe(true);
  });
});

describe('sub-menus', () => {
  const groups = [{ id: 'infra', name: 'Infrastructure', pages: ['network', 'docker', 'machines'] }];

  it('shows a sub-menu where its first page is, with its pages in page order', () => {
    const items = menuItems(tabs, groups);
    expect(items.map(item => item.id)).toEqual(['home', 'group:infra', 'media', 'music']);
    expect(itemPages(items[1]).map(tab => tab.id)).toEqual(['machines', 'docker', 'network']);
  });

  it('leaves out a sub-menu with none of its pages in this menu', () => {
    expect(menuItems(tabs.slice(4), groups).map(item => item.id)).toEqual(['media', 'music']);
  });

  it('keeps a page in one sub-menu only', () => {
    const read = readMenuSettings({ groups: [{ id: 'a', name: 'A', pages: ['home', 'media'] }, { id: 'b', name: 'B', pages: ['media', 'music'] }] });
    expect(read.groups?.map(group => group.pages)).toEqual([['home', 'media'], ['music']]);
  });
});
