import { describe, expect, it } from 'vitest';
import type { Category, Service } from '@/lib/types';
import { buildPortInventory, type DockerPortContainer } from './portInventory';

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: 'proxy', name: 'Nginx Proxy Manager', logo: '',
    localUrl: 'https://nas.example.test:8443', ...overrides,
  };
}

function category(services = [service()], overrides: Partial<Category> = {}): Category {
  return { id: 'network', title: 'Network', emoji: '', order: 0, services, ...overrides };
}

function container(overrides: Partial<DockerPortContainer> = {}): DockerPortContainer {
  return {
    id: 'container-proxy', names: ['/nginx-proxy-manager'], state: 'running',
    hostName: 'NAS', hostUrl: 'tcp://nas.example.test:2375',
    ports: [{ ip: '0.0.0.0', privatePort: 443, publicPort: 8443, type: 'tcp' }],
    ...overrides,
  };
}

function inventory(categories: Category[], containers: DockerPortContainer[], showSecretSections = true) {
  return buildPortInventory({ categories, containers, showSecretSections });
}

describe('buildPortInventory', () => {
  it('merges the service and Docker endpoint, retaining the service display and Docker status', () => {
    const entries = inventory([category()], [container({ names: ['/reverse-proxy'] })]);

    expect(entries).toEqual([{
      port: 8443,
      serviceName: 'Nginx Proxy Manager',
      ip: 'nas.example.test',
      type: 'HTTPS',
      origins: ['service', 'docker'],
      category: 'Network',
      dockerHost: 'NAS',
      containerName: '/reverse-proxy',
      status: 'running',
      stopped: false,
    }]);
  });

  it.each(['unix:///var/run/docker.sock', '', 'http://localhost:2375', 'tcp://127.0.0.1:2375'])(
    'matches normalized service/container names when the Docker host is local or unknown (%s)', hostUrl => {
      const entries = inventory([category()], [container({ hostUrl, names: ['/NGINX-proxy-manager'] })]);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        origins: ['service', 'docker'], serviceName: 'Nginx Proxy Manager', ip: 'nas.example.test',
      });
    },
  );

  it('keeps the same name and port separate on different known hosts', () => {
    const entries = inventory([category()], [container({ hostUrl: 'tcp://other.example.test:2375' })]);
    expect(entries).toHaveLength(2);
    expect(entries.map(entry => entry.origins)).toEqual([['service'], ['docker']]);
  });

  it('does not use the local-host fallback when names differ', () => {
    expect(inventory([category()], [container({ hostUrl: '', names: ['/other'] })])).toHaveLength(2);
  });

  it.each([
    ['tcp://first.example.test:2375', 'tcp://second.example.test:2375'],
    ['', ''],
    ['unix:///var/run/docker.sock', 'unix:///var/run/docker.sock'],
  ])('keeps containers on distinct Docker hosts separate (%s, %s)', (firstUrl, secondUrl) => {
    const entries = inventory([], [
      container({ hostName: 'First', hostUrl: firstUrl }),
      container({ hostName: 'Second', hostUrl: secondUrl }),
    ]);
    expect(entries).toHaveLength(2);
    expect(entries.map(entry => entry.dockerHost)).toEqual(['First', 'Second']);
  });

  it('does not collapse two local Docker hosts through the same service entry', () => {
    const entries = inventory([category()], [
      container({ hostName: 'First', hostUrl: '' }),
      container({ hostName: 'Second', hostUrl: '' }),
    ]);
    expect(entries).toHaveLength(2);
    expect(entries.map(entry => entry.origins)).toEqual([['service', 'docker'], ['docker']]);
  });

  it('keeps HTTP/TCP and UDP endpoints separate on the same host and port', () => {
    const entries = inventory([category()], [container({
      ports: [{ ip: 'nas.example.test', publicPort: 8443, type: 'udp' }],
    })]);
    expect(entries).toHaveLength(2);
    expect(entries.map(entry => entry.type)).toEqual(['HTTPS', 'UDP']);
  });

  it('also requires matching transport for the local name fallback', () => {
    const entries = inventory([category()], [container({
      hostUrl: '', ports: [{ ip: '0.0.0.0', publicPort: 8443, type: 'udp' }],
    })]);
    expect(entries).toHaveLength(2);
  });

  it('normalizes host case, whitespace and IPv6 brackets for endpoint matching', () => {
    const entries = inventory([
      category([service({ localUrl: 'http://[2001:db8::1]:8443' })]),
    ], [container({ ports: [{ ip: '  2001:DB8::1  ', publicPort: 8443, type: 'tcp' }] })]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ ip: '[2001:db8::1]', type: 'HTTP', origins: ['service', 'docker'] });
  });

  it('normalizes DNS host case and whitespace', () => {
    const entries = inventory([category()], [container({
      ports: [{ ip: ' NAS.EXAMPLE.TEST ', publicPort: 8443 }],
    })]);
    expect(entries).toHaveLength(1);
    expect(entries[0].origins).toEqual(['service', 'docker']);
  });

  it('resolves wildcard and missing binding IPs to the Docker host and deduplicates them', () => {
    const entries = inventory([], [container({
      ports: ['0.0.0.0', '::', undefined].map(ip => ({ ip, publicPort: 8443, type: 'tcp' })),
    })]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ ip: 'nas.example.test', origins: ['docker'], stopped: false });
  });

  it('preserves specific binding IPs and distinct published ports', () => {
    const entries = inventory([], [container({ ports: [
      { ip: '192.0.2.1', publicPort: 8443 },
      { ip: '192.0.2.2', publicPort: 8443 },
      { ip: '192.0.2.1', publicPort: 9443 },
      { ip: '192.0.2.1', privatePort: 80 },
    ] })]);
    expect(entries.map(entry => [entry.ip, entry.port])).toEqual([
      ['192.0.2.1', 8443], ['192.0.2.2', 8443], ['192.0.2.1', 9443],
    ]);
  });

  it('hides secret services and same-named Docker containers, including aliases', () => {
    const categories = [category([service({ name: 'Private App' })], { isSecret: true })];
    const containers = [container({ names: ['/unrelated-alias', '/PRIVATE APP'] })];
    expect(inventory(categories, containers, false)).toEqual([]);
    expect(inventory(categories, containers, true)).toHaveLength(1);
    expect(inventory(categories, containers, true)[0].origins).toEqual(['service', 'docker']);
    expect(inventory(categories, [container({ names: ['/visible'] })], false)).toHaveLength(1);
  });

  it('marks stopped containers and sorts services/running ports first, then stopped ports', () => {
    const entries = inventory([category()], [
      container({ names: ['/stopped'], state: 'exited', ports: [{ publicPort: 80 }] }),
      container({ names: ['/created'], state: 'created', ports: [{ publicPort: 53 }] }),
      container({ names: ['/running'], ports: [{ publicPort: 9000 }] }),
      container({ names: ['/running-low'], ports: [{ publicPort: 8080 }] }),
    ]);
    expect(entries.map(entry => [entry.port, entry.stopped])).toEqual([
      [8080, false], [8443, false], [9000, false], [53, true], [80, true],
    ]);
  });

  it('keeps a service entry active even when its merged container is stopped', () => {
    const entries = inventory([category()], [container({ state: 'exited' })]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ origins: ['service', 'docker'], status: 'exited', stopped: false });
  });

  it('parses secondary URLs, marks them and merges matching Docker endpoints', () => {
    const entries = inventory([category([service({ secondaryUrl: 'http://secondary.example.test:8080' })])], [
      container({ hostUrl: 'tcp://secondary.example.test:2375', ports: [{ publicPort: 8080 }] }),
    ]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      port: 8080, ip: 'secondary.example.test', type: 'HTTP', category: 'Network', secondary: true,
      origins: ['service', 'docker'], serviceName: 'Nginx Proxy Manager', status: 'running',
    });
    expect(entries[1].secondary).toBeUndefined();
  });

  it('preserves URL defaults, missing schemes and malformed URL handling', () => {
    const entries = inventory([category([
      service({ id: 'https', localUrl: 'https://secure.example.test' }),
      service({ id: 'http', localUrl: 'plain.example.test' }),
      service({ id: 'port', localUrl: 'explicit.example.test:8080' }),
      service({ id: 'bad', localUrl: 'http://[' }),
    ])], []);
    expect(entries.map(entry => [entry.port, entry.type])).toEqual([[80, 'HTTP'], [443, 'HTTPS'], [8080, 'HTTP']]);
  });

  it('treats HTTP and HTTPS on the same host/port as one TCP endpoint', () => {
    const entries = inventory([category([service({ secondaryUrl: 'http://nas.example.test:8443' })])], []);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'HTTPS', origins: ['service'] });
  });
});
