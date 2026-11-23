import { ARR_TYPES, DNS_TYPES, DOWNLOAD_CLIENT_TYPES, MEDIA_SERVER_TYPES, MUSIC_SERVER_TYPES, PHOTO_STATS_TYPES, UPS_TYPES, VPN_TUNNEL_TYPES } from '@/lib/widgetData/contracts';
import { selectableDeviceIntegrations } from '@/integrations/registry';
import { KIT_FAMILIES, kitFamilyOfWidget, type KitGuideFamily } from '@/integrations/kit';

/**
 * The first-run guide's families of connections and the widgets each one
 * offers. Built from the integration lists and the kit, so a new integration
 * of a known kind joins its family by itself; `guideFamilies.test.ts` fails
 * when an integration belongs to none.
 */
export type GuideFamilyId = 'machines' | 'docker' | 'media' | 'arr' | 'network' | 'power' | 'photos';
export const DOCKER_KINDS = ['socket', 'tcp', 'portainer', 'dockhand'] as const;
/** Connections set up elsewhere than in the guide (a key, a widget's own address). */
export const NOT_IN_GUIDE: ReadonlySet<string> = new Set(['tmdb', 'customapi']);

const kitKinds = (guide: KitGuideFamily) => KIT_FAMILIES.filter(family => family.guide === guide).flatMap(family => family.types);

export function guideFamilyKinds(): Record<GuideFamilyId, readonly string[]> {
  return {
    machines: [...selectableDeviceIntegrations().map(item => item.id), ...kitKinds('machines')],
    docker: [...DOCKER_KINDS, ...kitKinds('docker')],
    media: [...new Set([...MEDIA_SERVER_TYPES, ...MUSIC_SERVER_TYPES, ...kitKinds('media')])],
    arr: [...ARR_TYPES, ...DOWNLOAD_CLIENT_TYPES],
    network: ['tailscale', 'headscale', ...VPN_TUNNEL_TYPES, ...DNS_TYPES, ...kitKinds('network')],
    power: [...UPS_TYPES],
    photos: [...PHOTO_STATS_TYPES],
  };
}

/** Widgets offered by a connected family, then those that need nothing. */
export const SUGGESTIONS: { family: string; widgets: string[] }[] = [
  { family: 'machines', widgets: ['devices', 'metric-cpu', 'metric-memory'] },
  { family: 'docker', widgets: ['dockercontainers'] },
  { family: 'media', widgets: ['media-nowplaying', 'media-recent', 'music-nowplaying', 'music-recent'] },
  { family: 'arr', widgets: ['media-upcoming', 'media-queue', 'media-downloads'] },
  { family: 'network', widgets: ['dns', 'vpn', 'tailscale'] },
  { family: 'power', widgets: ['ups'] },
  { family: 'photos', widgets: ['photos', 'photos-stats'] },
  // Kit widgets join the family of their connections.
  ...KIT_FAMILIES.map(family => ({ family: family.guide, widgets: [family.widget] })),
];
export const ALWAYS = ['clock', 'weather', 'calendar', 'bookmarks'];
export const PRESELECTED = new Set(['devices', 'dockercontainers', 'media-nowplaying', 'music-nowplaying', 'media-downloads', 'dns', 'vpn', 'ups', 'clock', 'weather']);

/** Which widgets of a family make sense for what is connected (a VPN widget only with Gluetun, music with a music server…). */
export function familyWidgetConnected(widget: string, types: Set<string>): boolean {
  if (widget === 'dns') return DNS_TYPES.some(type => types.has(type));
  if (widget === 'vpn') return VPN_TUNNEL_TYPES.some(type => types.has(type));
  if (widget === 'tailscale') return types.has('tailscale') || types.has('headscale');
  if (widget === 'media-downloads') return DOWNLOAD_CLIENT_TYPES.some(type => types.has(type));
  if (widget === 'media-upcoming' || widget === 'media-queue') return ARR_TYPES.some(type => types.has(type));
  if (widget === 'media-nowplaying' || widget === 'media-recent') return MEDIA_SERVER_TYPES.some(type => types.has(type));
  if (widget === 'music-nowplaying' || widget === 'music-recent') return MUSIC_SERVER_TYPES.some(type => types.has(type));
  const kit = kitFamilyOfWidget(widget);
  if (kit) return kit.types.some(type => types.has(type));
  return true;
}

/** The families something is connected in (machines and Docker hosts are counted apart). */
export function connectedFamilies(types: Set<string>, hasMachines: boolean, hasDockerHosts: boolean): Set<string> {
  const kinds = guideFamilyKinds();
  const families = new Set<string>();
  for (const [id, list] of Object.entries(kinds)) if (list.some(type => types.has(type))) families.add(id);
  if (hasMachines) families.add('machines');
  if (hasDockerHosts) families.add('docker');
  for (const family of KIT_FAMILIES) if (family.types.some(type => types.has(type))) families.add(family.guide);
  return families;
}
