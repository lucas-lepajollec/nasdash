'use client';

import React, { useState } from 'react';
import { Braces, Cpu, Plug } from 'lucide-react';

/**
 * Logos of the integrations, from the dashboard-icons collection the service
 * logos already use. Libre Hardware Monitor has none: it shows a chip icon;
 * a custom API shows braces; any logo that fails to load, a plug.
 */
const ICONS = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons';
const LOGOS: Record<string, string> = {
  glances: `${ICONS}/svg/glances.svg`,
  netdata: `${ICONS}/svg/netdata.svg`,
  beszel: `${ICONS}/svg/beszel.svg`,
  prometheus: `${ICONS}/svg/prometheus.svg`,
  proxmox: `${ICONS}/svg/proxmox.svg`,
  docker: `${ICONS}/svg/docker.svg`,
  tcp: `${ICONS}/svg/docker.svg`,
  socket: `${ICONS}/svg/docker.svg`,
  podman: `${ICONS}/svg/podman.svg`,
  portainer: `${ICONS}/svg/portainer.svg`,
  dockhand: `${ICONS}/png/dockhand.png`,
  tailscale: `${ICONS}/svg/tailscale.svg`,
  headscale: `${ICONS}/svg/headscale.svg`,
  pihole: `${ICONS}/svg/pi-hole.svg`,
  adguard: `${ICONS}/svg/adguard-home.svg`,
  technitium: `${ICONS}/svg/technitium.svg`,
  gluetun: `${ICONS}/svg/gluetun.svg`,
  nut: `${ICONS}/svg/nut.svg`,
  apcupsd: `${ICONS}/svg/apc.svg`,
  immich: `${ICONS}/svg/immich.svg`,
  photoprism: `${ICONS}/svg/photoprism.svg`,
  jellyfin: `${ICONS}/svg/jellyfin.svg`,
  emby: `${ICONS}/svg/emby.svg`,
  plex: `${ICONS}/svg/plex.svg`,
  sonarr: `${ICONS}/svg/sonarr.svg`,
  radarr: `${ICONS}/svg/radarr.svg`,
  lidarr: `${ICONS}/svg/lidarr.svg`,
  prowlarr: `${ICONS}/svg/prowlarr.svg`,
  qbittorrent: `${ICONS}/svg/qbittorrent.svg`,
  transmission: `${ICONS}/svg/transmission.svg`,
  deluge: `${ICONS}/svg/deluge.svg`,
  sabnzbd: `${ICONS}/svg/sabnzbd.svg`,
  nzbget: `${ICONS}/svg/nzbget.svg`,
  tmdb: `${ICONS}/svg/tmdb.svg`,
  piwigo: `${ICONS}/svg/piwigo.svg`,
  librephotos: `${ICONS}/png/librephotos.png`,
};

/** `bare`: the logo alone, without its tile (inside widgets). */
export function IntegrationLogo({ id, size = 28, bare }: { id: string; size?: number; bare?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = LOGOS[id];
  return (
    <span className={`ndc-int-logo ${bare ? 'is-bare' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      {src && !failed
        ? <img src={src} alt="" width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} loading="lazy" onError={() => setFailed(true)} />
        : id === 'lhm' ? <Cpu size={Math.round(size * 0.55)} /> : id === 'customapi' ? <Braces size={Math.round(size * 0.55)} /> : <Plug size={Math.round(size * 0.55)} />}
    </span>
  );
}
