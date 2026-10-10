import { spawnSync } from 'node:child_process';

for (const script of ['container-smoke.mjs', 'container-first-start.mjs']) {
  const result = spawnSync(process.execPath, [`scripts/${script}`, ...process.argv.slice(2)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
