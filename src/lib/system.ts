import si from 'systeminformation';
import { SystemStats } from './types';

let cachedLatency: number = 0;
let lastLatencyFetch = 0;

export async function getSystemStats(): Promise<SystemStats> {
  const now = Date.now();

  // Latency (ping) prend parfois 1-2s. On l'actualise toutes les 15s sans bloquer
  if (now - lastLatencyFetch > 15000) {
    lastLatencyFetch = now; // Evite redéclenchement immédiat
    si.inetLatency().then(l => {
      cachedLatency = l;
    }).catch(() => {});
  }

  return {
    network: {
      latency: Math.round(cachedLatency || 0),
    },
  };
}
