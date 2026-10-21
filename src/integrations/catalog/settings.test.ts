import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/config', () => ({ readConfig: () => ({ integrations: [] }) }));
import { catalogKinds, externalSettings, followUpPhase, upcomingPhase, upcomingSources } from '@/lib/widgetData/arr';
import { getServiceIntegration } from '../registry';
import { validateConfigMutationBody } from '@/lib/configEntityValidation';
describe('combined source settings', () => {
  it('preserves ordered sources and legacy defaults', () => {
    expect(upcomingSources({})).toEqual(['arr']); expect(upcomingSources({ source: 'library' })).toEqual(['library']);
    expect(upcomingSources({ source: 'library', sources: ['external', 'arr'] })).toEqual(['external', 'arr']);
    expect(externalSettings({})).toEqual({ mode: 'watchlist', watchlist: [], kinds: ['series', 'anime', 'movie'] });
  });
  it.each([[], ['arr', 'arr'], ['external', 'library', 'arr', 'arr'], ['other'], 'arr', false])('rejects invalid sources %j', sources => expect(() => upcomingSources({ sources })).toThrow());
  it.each([[], ['anime', 'anime'], ['other'], 'anime'])('rejects invalid catalogue kinds %j', kinds => expect(() => catalogKinds({ catalogKinds: kinds })).toThrow());
  const entry = { provider: 'tvmaze', kind: 'series', id: 'Abc_12-3', title: 'Followed title' };
  it('bounds and sanitizes watchlist entries without forbidding empty titles', () => {
    expect(externalSettings({ watchlist: [{ ...entry, title: '', extra: 'private' }] }).watchlist).toEqual([{ ...entry, title: '' }]);
    expect(externalSettings({ watchlist: Array.from({ length: 100 }, () => entry) }).watchlist).toHaveLength(100);
    for (const watchlist of [{}, [null], [false], ['title'], [entry, { ...entry, id: '' }], [{ ...entry, id: 'a'.repeat(41) }], [{ ...entry, id: '1?token=secret' }], [{ ...entry, title: 'x'.repeat(201) }], [{ ...entry, provider: 'other' }], [{ ...entry, kind: 'episode' }], Array.from({ length: 101 }, () => entry)]) expect(() => externalSettings({ watchlist })).toThrow();
    for (const externalMode of ['other', false, 1]) expect(() => externalSettings({ externalMode })).toThrow();
  });
  it('registers TMDB with only a required secret and media category', () => {
    expect(getServiceIntegration('tmdb')).toMatchObject({ section: 'media', fields: [{ id: 'apiKey', kind: 'secret', required: true }] });
    expect(getServiceIntegration('tmdb')!.fields).toHaveLength(1);
    expect(() => validateConfigMutationBody({ integration: { type: 'tmdb', settings: {}, secrets: { apiKey: 'fictional' } } }, 'integration', 'POST')).not.toThrow();
  });
});
describe('release phases', () => {
  it.each([
    [{ kind: 'episode', episode: 1 }, 'announced'], [{ kind: 'episode', episode: 2 }, 'current'], [{ kind: 'album' }, 'announced'],
    [{ kind: 'movie', release: 'cinema' }, 'announced'], [{ kind: 'movie', release: 'digital' }, 'current'], [{ kind: 'movie', release: 'physical' }, 'current'],
  ] as const)('maps arr %j', (item, phase) => expect(upcomingPhase(item)).toBe(phase));
  it.each([
    [{ status: 'airing' }, 'current'], [{ status: 'upcoming', episode: 2 }, 'current'], [{ status: 'upcoming', episode: 1 }, 'announced'], [{ status: 'announced' }, 'announced'], [{ status: 'ended' }, 'announced'],
  ] as const)('maps library %j', (item, phase) => expect(followUpPhase(item)).toBe(phase));
});
