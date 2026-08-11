import { describe, expect, it } from 'vitest';
import { getDockerRequestKeys } from './useDocker';

describe('Docker polling visibility', () => {
  it('disables every Docker request while its tab is hidden', () => {
    expect(getDockerRequestKeys('host-1', 'container-1', false)).toEqual({
      containers: null,
      detail: null,
      images: null,
      volumes: null,
    });
  });

  it('restores list and detail requests when its tab becomes visible', () => {
    expect(getDockerRequestKeys('host-1', 'container-1', true)).toEqual({
      containers: '/api/docker/host-1/containers?all=true',
      detail: '/api/docker/host-1/containers/container-1',
      images: '/api/docker/host-1/images',
      volumes: '/api/docker/host-1/volumes',
    });
  });

  it('keeps the detail request paused until a container is selected', () => {
    expect(getDockerRequestKeys('host-1', null, true).detail).toBeNull();
  });
});
