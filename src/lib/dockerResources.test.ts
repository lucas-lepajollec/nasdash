import { describe, expect, it } from 'vitest';
import { dockerImageDisplayName, dockerImageMatchesContainer, isDockerImageUsed } from './dockerResources';
const oldId = 'a'.repeat(64), newId = 'b'.repeat(64);
describe('Docker image resource identity and labels', () => {
  it('keeps a retagged image in use by its full canonical identity', () => {
    expect(isDockerImageUsed({ id: oldId, repoTags: ['renamed:1'] }, [{ imageId: `sha256:${oldId}`, image: 'web:1' }])).toBe(true);
  });
  it('allows the same old tag to point at a genuinely unused new image', () => {
    expect(isDockerImageUsed({ id: newId, repoTags: ['web:1'], containers: 0 }, [{ imageId: oldId, image: 'web:1' }])).toBe(false);
    expect(dockerImageMatchesContainer({ id: newId, repoTags: ['web:1'] }, { imageId: oldId, image: 'web:1' })).toBe(false);
  });
  it('uses relay-provided stopped-container counts and legacy tag references defensively', () => {
    expect(isDockerImageUsed({ id: oldId, containers: 1 }, [])).toBe(true);
    expect(isDockerImageUsed({ id: oldId, repoTags: ['web:1'] }, [{ image: 'web:1' }])).toBe(true);
  });
  it('shows an available name for unused images without inventing a lost historical tag', () => {
    expect(dockerImageDisplayName({ id: oldId, repoTags: ['web:1'] })).toBe('web:1');
    expect(dockerImageDisplayName({ id: oldId, repoTags: [], repoDigests: ['registry.test/web@sha256:abc'] })).toBe('registry.test/web');
    expect(dockerImageDisplayName({ id: oldId, repoTags: [], labels: { 'org.opencontainers.image.title': 'Web' } })).toBe('Web');
    expect(dockerImageDisplayName({ id: oldId, repoTags: [] })).toBe(`sha256:${oldId.slice(0, 12)}`);
  });
});
