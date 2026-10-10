import { checkInstallationLanguage } from './installation-language.mjs';

const failures = checkInstallationLanguage(process.cwd());
if (failures.length) {
  console.error(`Installation language check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Checked operational log copy, Docker startup and public installation examples: no detected French leftovers.');
}
