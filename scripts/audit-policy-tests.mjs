import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditBlockers, exceptionExpiresAt } from './audit-dependencies.mjs';

const now = new Date('2026-10-10T12:00:00Z');
function fixture() {
  const report = { auditReportVersion: 2, vulnerabilities: {
    braces: { severity: 'high', nodes: ['node_modules/braces'], via: [{
      name: 'braces', url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
    }] },
    micromatch: { severity: 'high', nodes: ['node_modules/micromatch'], via: ['braces'] },
  } };
  const lock = { packages: {
    'node_modules/braces': { dev: true }, 'node_modules/micromatch': { dev: true },
  } };
  return { report, lock };
}
test('allows only the approved development advisory and its development dependents', () => {
  const { report, lock } = fixture();
  assert.deepEqual(auditBlockers(report, lock, now), []);
});
test('expires automatically at the agreed deadline', () => {
  const { report, lock } = fixture();
  assert.deepEqual(auditBlockers(report, lock, new Date(exceptionExpiresAt)), ['braces', 'micromatch']);
});
test('blocks production inclusion, missing nodes and missing lock entries', () => {
  for (const mutate of [
    (r, l) => { l.packages['node_modules/braces'].dev = false; },
    (r) => { r.vulnerabilities.braces.nodes = []; },
    (r, l) => { delete l.packages['node_modules/braces']; },
  ]) {
    const { report, lock } = fixture(); mutate(report, lock);
    assert.deepEqual(auditBlockers(report, lock, now), ['braces', 'micromatch']);
  }
});
test('blocks any other advisory, including a second advisory on braces', () => {
  const { report, lock } = fixture();
  report.vulnerabilities.braces.via.push({ name: 'braces', url: 'https://github.com/advisories/GHSA-other' });
  report.vulnerabilities.other = { severity: 'moderate', nodes: [], via: [] };
  assert.deepEqual(auditBlockers(report, lock, now), ['braces', 'micromatch', 'other']);
});
test('blocks unresolved and cyclic advisory chains', () => {
  for (const via of ['missing', 'micromatch']) {
    const { report, lock } = fixture(); report.vulnerabilities.braces.via = [via];
    assert.deepEqual(auditBlockers(report, lock, now), ['braces', 'micromatch']);
  }
});
test('rejects broken reports rather than passing on an audit service error', () => {
  const { report, lock } = fixture();
  for (const invalid of [{}, { ...report, error: { message: 'Unavailable' } },
    { ...report, vulnerabilities: [] }, { ...report, vulnerabilities: { braces: { severity: 'unknown' } } }]) {
    assert.throws(() => auditBlockers(invalid, lock, now));
  }
  assert.throws(() => auditBlockers(report, lock, new Date('invalid')));
});
