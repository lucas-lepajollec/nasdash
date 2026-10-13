import { describe, expect, it } from 'vitest';
import { resolveDockerTarget } from './dockerTargets';
import type { DockerContainer } from './types';
const container = (name: string, id: string, service?: string) => ({ id, fullId: id, names: [name], state: 'running', labels: service ? { 'com.docker.compose.service': service } : {} } as DockerContainer);

describe('Docker quick action target resolution', () => {
  it('ignores a backup prefix and chooses the Compose suffix regardless of list order', () => {
    const backup = container('audit-db-backup', 'backup');
    const db = container('audit-db', 'database');
    for (const list of [[backup, db], [db, backup]]) expect(resolveDockerTarget(list, 'db')).toBe(db);
  });
  it('prioritises exact container names over Compose service labels', () => {
    const exact = container('/DB', 'exact');
    expect(resolveDockerTarget([container('stack-other', 'other', 'db'), exact], 'db')).toBe(exact);
  });
  it('supports Compose v1 and v2 replica suffixes while refusing ambiguous replicas', () => {
    const first = container('stack_db_1', 'one');
    expect(resolveDockerTarget([first], 'db')).toBe(first);
    expect(() => resolveDockerTarget([first, container('other-db-2', 'two')], 'db')).toThrow('ambiguous_target');
  });
  it('never turns an arbitrary substring into an operational target', () => {
    expect(() => resolveDockerTarget([container('database-backup', 'backup')], 'db')).toThrow('missing_target');
  });
});
