type ImageIdentity = { id: string; containers?: number; repoTags?: string[] };
type ContainerImage = { imageId?: string; image?: string };
const canonicalId = (id: string) => id.replace(/^sha256:/, '');
/** A known image ID wins over a mutable tag. Tags are a legacy fallback only. */
export function dockerImageMatchesContainer(image: ImageIdentity, container: ContainerImage): boolean {
  return container.imageId ? canonicalId(container.imageId) === canonicalId(image.id) : !!image.repoTags?.includes(container.image ?? '');
}
export function isDockerImageUsed(image: ImageIdentity, containers: ContainerImage[]): boolean {
  return (image.containers ?? 0) > 0 || containers.some(container => dockerImageMatchesContainer(image, container));
}
export function dockerImageDisplayName(image: { id: string; repoTags?: string[]; repoDigests?: string[]; labels?: Record<string, string> }): string {
  return image.repoTags?.find(tag => tag !== '<none>:<none>')
    || image.repoDigests?.[0]?.split('@')[0]
    || image.labels?.['org.opencontainers.image.title']
    || image.labels?.['org.opencontainers.image.ref.name']
    || `sha256:${canonicalId(image.id).slice(0, 12)}`;
}
