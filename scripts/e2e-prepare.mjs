import fs from 'node:fs';
import path from 'node:path';

const projectDirectory = process.cwd();
const e2eDirectory = path.resolve(projectDirectory, '.e2e');
const dataDirectory = path.join(e2eDirectory, 'data');
const sourceDataDirectory = path.join(projectDirectory, 'data');

if (path.dirname(dataDirectory) !== e2eDirectory) {
  throw new Error('Refusing to prepare an E2E data directory outside .e2e.');
}

fs.rmSync(dataDirectory, { recursive: true, force: true });
fs.mkdirSync(path.join(dataDirectory, 'logos'), { recursive: true });

for (const entry of fs.readdirSync(sourceDataDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.example.json')) {
    fs.copyFileSync(
      path.join(sourceDataDirectory, entry.name),
      path.join(dataDirectory, entry.name),
    );
  }
}

if (process.env.NASDASH_E2E_SERVER_MODE === 'production') {
  const configuredDistDirectory = process.env.NASDASH_NEXT_DIST_DIR?.trim() || '.next';
  const distDirectory = path.resolve(projectDirectory, configuredDistDirectory);
  const relativeDistDirectory = path.relative(projectDirectory, distDirectory);
  if (relativeDistDirectory.startsWith('..') || path.isAbsolute(relativeDistDirectory)) {
    throw new Error('The production E2E build directory must stay inside the project.');
  }

  const serverDirectory = path.join(distDirectory, 'standalone');
  const standaloneServer = path.join(serverDirectory, 'server.js');
  if (!fs.existsSync(standaloneServer)) {
    throw new Error(`Standalone build not found: ${standaloneServer}`);
  }

  fs.cpSync(
    path.join(distDirectory, 'static'),
    path.join(serverDirectory, relativeDistDirectory, 'static'),
    { recursive: true, force: true },
  );
  fs.cpSync(
    path.join(projectDirectory, 'public'),
    path.join(serverDirectory, 'public'),
    { recursive: true, force: true },
  );
}
