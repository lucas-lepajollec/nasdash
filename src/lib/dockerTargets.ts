import type { DockerContainer } from './types';

const normalize = (name: string) => name.replace(/^\//, '').trim().toLowerCase();
/** Resolve exact names first, then Compose labels/suffixes; never arbitrary substrings. */
export function resolveDockerTarget(containers: DockerContainer[], target: string): DockerContainer {
  const wanted = normalize(target);
  if (!wanted) throw new Error('docker.failure.missing_target');
  const exact = containers.filter(container => (container.names || []).some(name => normalize(name) === wanted));
  const matches = exact.length ? exact : containers.filter(container =>
    container.labels?.['com.docker.compose.service'] === wanted
    || (container.names || []).some(name => {
      const value = normalize(name);
      return value.endsWith(`-${wanted}`) || value.endsWith(`_${wanted}`)
        || new RegExp(`[-_]${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-_]\\d+$`).test(value);
    })
  );
  if (matches.length !== 1) throw new Error(matches.length ? 'docker.failure.ambiguous_target' : 'docker.failure.missing_target');
  return matches[0];
}
