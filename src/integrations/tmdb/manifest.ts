import type { ServiceIntegrationManifest } from '../types';
export const tmdbManifest: ServiceIntegrationManifest = {
  id: 'tmdb', name: 'TMDB', section: 'media',
  fields: [{ id: 'apiKey', kind: 'secret', required: true, label: 'integrations.tmdb.apiKey' }],
};
