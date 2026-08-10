import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DockerRequestError,
  dockerJsonFetcher,
  getDockerErrorPresentation,
  type DockerFailurePayload,
} from './dockerErrorContract';

const unavailable: DockerFailurePayload = {
  error: 'Hôte arrêté.',
  code: 'host_unreachable',
  category: 'unavailable',
  hint: 'NasDash réessaiera automatiquement.',
  retryable: true,
  isOffline: true,
};

describe('Docker browser error contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the structured server diagnosis in the SWR error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(unavailable), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })));

    await expect(dockerJsonFetcher('/api/docker/host/containers')).rejects.toMatchObject({
      name: 'DockerRequestError',
      category: 'unavailable',
      code: 'host_unreachable',
      hint: unavailable.hint,
    });
  });

  it('presents temporary outages as warnings and bad settings as errors', () => {
    expect(getDockerErrorPresentation(new DockerRequestError(503, unavailable))).toMatchObject({
      title: 'Hôte Docker indisponible',
      tone: 'warning',
    });

    expect(getDockerErrorPresentation(new DockerRequestError(422, {
      ...unavailable,
      code: 'invalid_url',
      category: 'configuration',
      retryable: false,
      isOffline: false,
    }))).toMatchObject({ title: 'Configuration Docker invalide', tone: 'error' });
  });

  it('names DNS failures precisely while keeping them at warning level', () => {
    expect(getDockerErrorPresentation(new DockerRequestError(503, {
      ...unavailable,
      code: 'name_resolution',
    }))).toMatchObject({ title: 'Nom d’hôte Docker introuvable', tone: 'warning' });
  });
});
