import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { LegacyConfigData, SplitConfigPaths, migrateLegacySplitFiles } from './configMigration';

function withMigrationFixture(run: (fixture: {
  directory: string;
  paths: SplitConfigPaths;
  write: (filePath: string, data: string) => void;
}) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-migration-'));
  const makePaths = (name: string) => ({
    target: path.join(directory, `${name}.json`),
    example: path.join(directory, `${name}.example.json`),
  });
  const paths = {
    services: makePaths('services'),
    topology: makePaths('topology'),
    calendar: makePaths('calendar'),
  };

  try {
    run({
      directory,
      paths,
      write: (filePath, data) => fs.writeFileSync(filePath, data, 'utf8'),
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe('legacy split-file migration', () => {
  it('replaces Docker entrypoint placeholders with the real legacy data', () => {
    withMigrationFixture(({ paths, write }) => {
      const exampleServices = [{ id: 'example', title: 'Example', services: [] }];
      fs.writeFileSync(paths.services.example, JSON.stringify(exampleServices), 'utf8');
      fs.copyFileSync(paths.services.example, paths.services.target);
      const legacy: LegacyConfigData = {
        categories: [{ id: 'homelab', title: 'Homelab', services: [{ id: 'nas', name: 'NAS' }] }],
      };

      expect(migrateLegacySplitFiles(legacy, paths, write)).toBe(true);
      expect(JSON.parse(fs.readFileSync(paths.services.target, 'utf8'))[0].id).toBe('homelab');
      expect(legacy.categories).toBeUndefined();
    });
  });

  it('preserves an already customized split file as the newer source of truth', () => {
    withMigrationFixture(({ paths, write }) => {
      fs.writeFileSync(paths.services.example, JSON.stringify([{ id: 'example' }]), 'utf8');
      fs.writeFileSync(paths.services.target, JSON.stringify([{ id: 'current' }]), 'utf8');
      const legacy: LegacyConfigData = { categories: [{ id: 'legacy' }] };

      migrateLegacySplitFiles(legacy, paths, write);

      expect(JSON.parse(fs.readFileSync(paths.services.target, 'utf8'))[0].id).toBe('current');
      expect(legacy.categories).toBeUndefined();
    });
  });

  it('moves topology and calendar data when their split files are missing', () => {
    withMigrationFixture(({ paths, write }) => {
      const legacy: LegacyConfigData = {
        settings: { networkTopology: { nodes: [{ id: 'nas' }], groups: [], connections: [] } },
        localEvents: [{ id: 'maintenance', title: 'Maintenance', start: '2026-08-10' }],
      };

      migrateLegacySplitFiles(legacy, paths, write);

      expect(JSON.parse(fs.readFileSync(paths.topology.target, 'utf8')).nodes[0].id).toBe('nas');
      expect(JSON.parse(fs.readFileSync(paths.calendar.target, 'utf8'))[0].id).toBe('maintenance');
      expect(legacy.settings?.networkTopology).toBeUndefined();
      expect(legacy.localEvents).toBeUndefined();
    });
  });
});
