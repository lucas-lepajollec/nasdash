import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FORMAT_VERSION = 1;

export function getDefaultDataDirectory() {
  const configuredDirectory = process.env.NASDASH_DATA_DIR?.trim();
  return configuredDirectory
    ? path.resolve(configuredDirectory)
    : path.join(process.cwd(), 'data');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function assertSafeDirectory(directory, label) {
  const resolved = path.resolve(directory);
  if (resolved === path.parse(resolved).root) {
    throw new Error(`${label} ne peut pas être la racine du disque.`);
  }
  return resolved;
}

export function createDataBackup({ source, output, appVersion = 'unknown' }) {
  const sourceDirectory = assertSafeDirectory(source, 'La source');
  const outputDirectory = assertSafeDirectory(output, 'La destination');
  if (!fs.existsSync(sourceDirectory) || !fs.statSync(sourceDirectory).isDirectory()) {
    throw new Error(`Dossier de données introuvable : ${sourceDirectory}`);
  }
  if (fs.existsSync(outputDirectory)) {
    throw new Error(`La destination existe déjà : ${outputDirectory}`);
  }

  fs.mkdirSync(outputDirectory, { recursive: true });
  try {
    fs.cpSync(sourceDirectory, path.join(outputDirectory, 'data'), { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, 'nasdash-backup.json'), JSON.stringify({
      formatVersion: FORMAT_VERSION,
      appVersion,
      createdAt: new Date().toISOString(),
    }, null, 2), 'utf8');
  } catch (error) {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
    throw error;
  }
  return outputDirectory;
}

export function restoreDataBackup({ backup, target, force = false }) {
  if (!force) throw new Error('La restauration exige l’option --force.');

  const backupDirectory = assertSafeDirectory(backup, 'La sauvegarde');
  const targetDirectory = assertSafeDirectory(target, 'La destination');
  const manifestPath = path.join(backupDirectory, 'nasdash-backup.json');
  const backupDataPath = path.join(backupDirectory, 'data');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(backupDataPath)) {
    throw new Error('Sauvegarde NasDash invalide ou incomplète.');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.formatVersion !== FORMAT_VERSION) {
    throw new Error(`Version de sauvegarde non prise en charge : ${manifest.formatVersion}`);
  }

  const parent = path.dirname(targetDirectory);
  fs.mkdirSync(parent, { recursive: true });
  const suffix = `${process.pid}-${Date.now()}`;
  const stageDirectory = `${targetDirectory}.restore-stage-${suffix}`;
  const recoveryDirectory = `${targetDirectory}.pre-restore-${timestamp()}`;
  let movedCurrentData = false;

  try {
    fs.cpSync(backupDataPath, stageDirectory, { recursive: true });
    if (fs.existsSync(targetDirectory)) {
      fs.renameSync(targetDirectory, recoveryDirectory);
      movedCurrentData = true;
    }
    fs.renameSync(stageDirectory, targetDirectory);
  } catch (error) {
    fs.rmSync(stageDirectory, { recursive: true, force: true });
    if (movedCurrentData && !fs.existsSync(targetDirectory) && fs.existsSync(recoveryDirectory)) {
      fs.renameSync(recoveryDirectory, targetDirectory);
    }
    throw error;
  }

  return { target: targetDirectory, recovery: movedCurrentData ? recoveryDirectory : null };
}

function parseArgs(argv) {
  const values = { force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') values.force = true;
    else if (arg.startsWith('--')) values[arg.slice(2)] = argv[++index];
  }
  return values;
}

function readAppVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function runCli() {
  const [command, ...rawArgs] = process.argv.slice(2);
  const args = parseArgs(rawArgs);
  if (command === 'backup') {
    const output = args.output || path.join(process.cwd(), 'backups', `nasdash-${timestamp()}`);
    const result = createDataBackup({
      source: args.source || getDefaultDataDirectory(),
      output,
      appVersion: readAppVersion(),
    });
    console.log(`[NASDASH] Sauvegarde créée : ${result}`);
    return;
  }
  if (command === 'restore') {
    if (!args.from) throw new Error('Usage : data:restore -- --from <dossier> --force');
    const result = restoreDataBackup({
      backup: args.from,
      target: args.target || getDefaultDataDirectory(),
      force: args.force,
    });
    console.log(`[NASDASH] Données restaurées : ${result.target}`);
    if (result.recovery) console.log(`[NASDASH] Anciennes données conservées : ${result.recovery}`);
    return;
  }
  throw new Error('Usage : data-snapshot.mjs <backup|restore> [options]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(`[NASDASH] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
