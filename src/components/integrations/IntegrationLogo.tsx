'use client';

import React, { useState } from 'react';
import { Cpu, Plug } from 'lucide-react';

/**
 * Logos of the integrations, from the dashboard-icons collection the service
 * logos already use. Libre Hardware Monitor has none: it shows a chip icon,
 * as does any logo that fails to load.
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
};

export function IntegrationLogo({ id, size = 28 }: { id: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = LOGOS[id];
  return (
    <span className="ndc-int-logo" style={{ width: size, height: size }} aria-hidden="true">
      {src && !failed
        ? <img src={src} alt="" width={Math.round(size * 0.72)} height={Math.round(size * 0.72)} loading="lazy" onError={() => setFailed(true)} />
        : id === 'lhm' ? <Cpu size={Math.round(size * 0.55)} /> : <Plug size={Math.round(size * 0.55)} />}
    </span>
  );
}
