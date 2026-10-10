import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rawPort = process.env.NASDASH_DEMO_PORT?.trim() || '2505';
const port = Number.parseInt(rawPort, 10);
const lan = process.argv.includes('--lan');
const host = lan ? '0.0.0.0' : '127.0.0.1';

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error(`[NASDASH] Invalid demo port: ${rawPort}`);
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
  console.error(`[NASDASH] Port ${port} is already in use.`);
  console.error("[NASDASH] If the Docker demo is running, stop it with: npm run demo:docker:down");
  console.error("[NASDASH] Otherwise, choose another port with NASDASH_DEMO_PORT (for example 2506).");
  process.exit(1);
}

const nextEntryPoint = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const extraArguments = process.argv.slice(2).filter(argument => argument !== '--lan');

console.log(`[NASDASH] Isolated demo ${lan ? "on the local network" : "local only"} : http://${lan ? "<MACHINE-IP>" : '127.0.0.1'}:${port}`);
console.log("[NASDASH] Hot reload enabled. Stop with Ctrl+C.");

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
  console.error(`[NASDASH] Cannot start the demo: ${error.message}`);
  process.exit(1);
});

child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
