import { describe, expect, it } from 'vitest';
import { SERVICE_INTEGRATIONS, selectableDeviceIntegrations } from '@/integrations/registry';
import { getWidgetCatalogEntry } from '@/lib/widgets/catalog';
import { ALWAYS, connectedFamilies, familyWidgetConnected, guideFamilyKinds, NOT_IN_GUIDE, SUGGESTIONS } from './guideFamilies';

describe('first-run guide families', () => {
  const kinds = new Set(Object.values(guideFamilyKinds()).flat());
  it('offers every integration in a family (a new one cannot be forgotten)', () => {
    const missing = [...SERVICE_INTEGRATIONS.map(item => item.id), ...selectableDeviceIntegrations().map(item => item.id)]
      .filter(id => !NOT_IN_GUIDE.has(id) && !kinds.has(id));
    expect(missing).toEqual([]);
  });
  it('suggests only widgets that exist', () => {
    const unknown = [...SUGGESTIONS.flatMap(item => item.widgets), ...ALWAYS].filter(widget => !getWidgetCatalogEntry(widget));
    expect(unknown).toEqual([]);
  });
  it('offers music widgets for a music server and video ones for a video server', () => {
    const navidrome = new Set(['navidrome']);
    expect(connectedFamilies(navidrome, false, false).has('media')).toBe(true);
    expect(familyWidgetConnected('music-nowplaying', navidrome)).toBe(true);
    expect(familyWidgetConnected('media-nowplaying', navidrome)).toBe(false);
    const jellyfin = new Set(['jellyfin']);
    expect(familyWidgetConnected('media-nowplaying', jellyfin)).toBe(true);
    expect(familyWidgetConnected('music-nowplaying', jellyfin)).toBe(true);
  });
});
