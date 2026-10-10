import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const directory = path.resolve(process.env.NASDASH_DATA_DIR?.trim() || '/app/data');
const identity = `${process.getuid()}:${process.getgid()}`;
const probe = folder => {
  const first = path.join(folder, `.nasdash-permission-${crypto.randomUUID()}`);
  const second = first + '.renamed';
  try {
    fs.writeFileSync(first, '', { flag: 'wx', mode: 0o600 });
    fs.renameSync(first, second);
    fs.unlinkSync(second);
  } finally {
    for (const file of [first, second]) {
      try { fs.unlinkSync(file); } catch { /* Missing or inaccessible probe. */ }
    }
  }
};

try {
  fs.mkdirSync(path.join(directory, 'logos'), { recursive: true });
  probe(directory);
  probe(path.join(directory, 'logos'));
  // Existing account/secret files must be readable. Never change ownership.
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile()) fs.accessSync(path.join(directory, entry.name), fs.constants.R_OK);
  }
} catch (error) {
  console.error(`[NASDASH] Data permission check failed: ${directory}; runtime UID:GID ${identity}; ${error.code || 'UNKNOWN'}.`);
  console.error('[NASDASH] Grant this user read/write access to the mounted data folder and existing files. On Synology, check the shared-folder ACL and Compose user: "UID:GID". PUID/PGID environment variables are not supported. See https://docs.nasdash.lucas-homelab.fr/en/docs/getting-started/docker-installation.');
  process.exit(1);
}

function atomicWrite(target, contents) {
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, target);
  } finally {
    try { fs.unlinkSync(temporary); } catch { /* Already renamed. */ }
  }
}

try {
  console.info(`[NASDASH] Data directory ready: ${directory}; runtime UID:GID ${identity}.`);
  console.info('[NASDASH] Updating configuration templates...');
  for (const name of ['config', 'services', 'topology', 'calendar', 'custom_tabs', 'users']) {
    const template = fs.readFileSync(`/app/defaults/${name}.example.json`);
    atomicWrite(path.join(directory, `${name}.example.json`), template);
    const target = path.join(directory, `${name}.json`);
    if (!fs.existsSync(target)) {
      atomicWrite(target, template);
      console.info(`[NASDASH] Created: ${name}.json (from ${name}.example.json)`);
    } else {
      console.info(`[NASDASH] ${name}.json already exists`);
    }
  }
} catch (error) {
  console.error(`[NASDASH] Data initialization failed: ${error.code || 'UNKNOWN'}. Startup aborted; existing data has not been reset.`);
  process.exit(1);
}
