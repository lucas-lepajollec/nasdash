import { describe, expect, it } from 'vitest';
import type { IntegrationInstance } from '@/lib/types';
import { tunnelServices, type TunnelContainer } from './dependents';

const instance = (url = 'http://nas.example.com:8000'): IntegrationInstance => ({ id: 'g', type: 'gluetun', name: 'Gluetun', settings: { url }, secrets: {} });
const project = { 'com.docker.compose.project': 'downloads' };
const container = (id: string, name: string, extra: Partial<TunnelContainer> = {}): TunnelContainer => ({ Id: id, Names: [`/${name}`], State: 'running', Labels: { ...project, 'com.docker.compose.service': name }, ...extra });

describe('services behind Gluetun', () => {
  it('lists the containers sharing its network, by id or by name, with their state', () => {
    const containers = [
      container('g1', 'gluetun', { Image: 'qmcgaw/gluetun', Ports: [{ PublicPort: 8000 }] }),
      container('q1', 'qbittorrent', { HostConfig: { NetworkMode: 'container:g1' } }),
      container('p1', 'prowlarr', { HostConfig: { NetworkMode: 'container:gluetun' }, State: 'exited' }),
      container('j1', 'jellyfin', { HostConfig: { NetworkMode: 'bridge' } }),
    ];
    expect(tunnelServices(instance(), containers)).toEqual({ services: [{ name: 'prowlarr', running: false }, { name: 'qbittorrent', running: true }], detached: [] });
  });
  it('flags services still tied to a Gluetun container that was recreated', () => {
    const containers = [
      container('g2', 'gluetun', { Image: 'qmcgaw/gluetun:v3' }),
      container('q1', 'qbittorrent', { HostConfig: { NetworkMode: 'container:g1-old' } }),
      container('o1', 'other', { HostConfig: { NetworkMode: 'container:gone' }, Labels: { 'com.docker.compose.project': 'elsewhere' } }),
    ];
    expect(tunnelServices(instance(), containers)).toEqual({ services: [], detached: ['qbittorrent'] });
  });
  it('picks the Gluetun publishing the control port among several, and gives up when none is found', () => {
    const containers = [
      container('a', 'gluetun-a', { Image: 'qmcgaw/gluetun', Ports: [{ PublicPort: 8001 }] }),
      container('b', 'gluetun-b', { Image: 'qmcgaw/gluetun', Ports: [{ PublicPort: 8000 }] }),
      container('x', 'x', { HostConfig: { NetworkMode: 'container:a' } }),
      container('y', 'y', { HostConfig: { NetworkMode: 'container:b' } }),
    ];
    expect(tunnelServices(instance('http://nas.example.com:8001'), containers)?.services).toEqual([{ name: 'x', running: true }]);
    expect(tunnelServices(instance(), containers)?.services).toEqual([{ name: 'y', running: true }]);
    expect(tunnelServices(instance(), [container('j', 'jellyfin', { Image: 'jellyfin/jellyfin' })])).toBeUndefined();
  });
});
