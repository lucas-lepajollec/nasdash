import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Lucas approved this one development-only exception on 2026-10-10.
export const exceptionExpiresAt = '2026-11-23T00:00:00.000Z';
const advisoryUrl = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const exceptionPackages = new Set([
  'braces', 'micromatch', 'fast-glob', '@next/eslint-plugin-next', 'eslint-config-next',
]);
const blockingSeverities = new Set(['moderate', 'high', 'critical']);
const severities = new Set(['info', 'low', ...blockingSeverities]);

export function auditBlockers(report, lock, now = new Date()) {
  if (report?.error || report?.auditReportVersion !== 2 ||
      !report.vulnerabilities || typeof report.vulnerabilities !== 'object' ||
      Array.isArray(report.vulnerabilities) || !lock?.packages ||
      !Number.isFinite(now.getTime())) {
    throw new Error('Invalid audit report, lockfile or audit time; refusing to pass.');
  }
  const findings = report.vulnerabilities;
  function exempt(name, visited = new Set()) {
    const finding = findings[name];
    if (!exceptionPackages.has(name) || visited.has(name) || !finding ||
        !Array.isArray(finding.nodes) || finding.nodes.length === 0 ||
        !finding.nodes.every((node) => lock.packages[node]?.dev === true) ||
        !Array.isArray(finding.via) || finding.via.length === 0) return false;
    const path = new Set([...visited, name]);
    return finding.via.every((via) => typeof via === 'string'
      ? exempt(via, path)
      : name === 'braces' && via?.name === 'braces' && via.url === advisoryUrl);
  }
  const exceptionActive = now.getTime() < Date.parse(exceptionExpiresAt);
  return Object.entries(findings).flatMap(([name, finding]) => {
    if (!severities.has(finding?.severity)) throw new Error(`Invalid severity for ${name}.`);
    if (!blockingSeverities.has(finding.severity)) return [];
    return exceptionActive && exempt(name) ? [] : [name];
  });
}

function runAudit(args) {
  const result = spawnSync('npm', ['audit', '--audit-level=moderate', ...args], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error(`npm audit failed: ${result.error?.message ?? result.stderr}`);
  }
  return result;
}

function main() {
  // Production always keeps the standard npm gate, without any exception.
  const production = runAudit(['--omit=dev']);
  process.stdout.write(production.stdout);
  if (production.status !== 0) throw new Error('Production dependency audit failed.');
  const result = runAudit(['--json']);
  const report = JSON.parse(result.stdout);
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const blockers = auditBlockers(report, lock);
  if (blockers.length) throw new Error(`Dependency audit blocked: ${blockers.join(', ')}`);
  const count = Object.keys(report.vulnerabilities).length;
  console.log(count === 0 ? 'All dependency audits passed.' :
    `Audit passed with only the approved development advisory ${advisoryUrl}; exception expires ${exceptionExpiresAt}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
