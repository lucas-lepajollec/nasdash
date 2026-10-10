import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { checkInstallationLanguage, EXAMPLE_FILES } from './installation-language.mjs';

let directory;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nasdash-language-guard-'));
  for (const folder of ['src', 'scripts', 'data']) fs.mkdirSync(path.join(directory, folder));
  fs.writeFileSync(path.join(directory, 'docker-entrypoint.sh'), 'echo "Starting the application"\n');
  fs.writeFileSync(path.join(directory, 'src/main.ts'), 'console.info("Application started");');
  for (const name of EXAMPLE_FILES) fs.writeFileSync(path.join(directory, 'data', `${name}.example.json`), '{}');
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

it('rejects French console copy, interpolated diagnostics, startup messages and supplied resource names', () => {
  fs.writeFileSync(path.join(directory, 'src/main.ts'), 'console.warn(`Impossible de joindre ${host}`); new MonitoringConfigurationError("Adresse manquante"); throw new Error("Erreur de sauvegarde");');
  fs.writeFileSync(path.join(directory, 'docker-entrypoint.sh'), 'echo "Démarrage de l’application"\n');
  fs.writeFileSync(path.join(directory, 'data/services.example.json'), '[{"services":[{"name":"Service Exemple 1"}]}]');
  const failures = checkInstallationLanguage(directory);
  expect(failures).toHaveLength(5);
  expect(failures.join('\n')).toContain('services.example.json');
});

it('ignores user data, translation keys, comments and test fixtures', () => {
  fs.writeFileSync(path.join(directory, 'data/config.json'), 'not JSON: private user configuration must never be read');
  fs.writeFileSync(path.join(directory, 'src/main.ts'), '// Démarrage\nconst label = t("Calendrier"); console.info(`Connected ${userName}`);');
  fs.writeFileSync(path.join(directory, 'src/main.test.ts'), 'console.error("Erreur");');
  expect(checkInstallationLanguage(directory)).toEqual([]);
});
