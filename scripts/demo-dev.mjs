import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rawPort = process.env.NASDASH_DEMO_PORT?.trim() || '2505';
const port = Number.parseInt(rawPort, 10);
const host = process.env.NASDASH_DEMO_HOST?.trim() || '0.0.0.0';

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error(`[NASDASH] Port de démonstration invalide : ${rawPort}`);
  process.exit(1);
}

function isPortAvailable(targetPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: targetPort });
    socket.setTimeout(750);
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(true));
  });
}

if (!(await isPortAvailable(port))) {
  console.error(`[NASDASH] Le port ${port} est déjà utilisé.`);
  console.error('[NASDASH] Si la démo Docker tourne, arrête-la avec : npm run demo:docker:down');
  console.error('[NASDASH] Sinon, choisis un autre port avec : $env:NASDASH_DEMO_PORT="2506"');
  process.exit(1);
}

const nextEntryPoint = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const extraArguments = process.argv.slice(2);

console.log(`[NASDASH] Démo locale isolée : http://localhost:${port}`);
console.log('[NASDASH] Rechargement à chaud actif. Arrêt : Ctrl+C');

const child = spawn(
  process.execPath,
  [nextEntryPoint, 'dev', '-H', host, '-p', String(port), ...extraArguments],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NASDASH_DEMO_MODE: 'true',
      NASDASH_JWT_SECRET: process.env.NASDASH_JWT_SECRET || 'nasdash-local-demo-runtime-only',
      NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || '1',
    },
  },
);

child.once('error', (error) => {
  console.error(`[NASDASH] Impossible de lancer la démo : ${error.message}`);
  process.exit(1);
});

child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
