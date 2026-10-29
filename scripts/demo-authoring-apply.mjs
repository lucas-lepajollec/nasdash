// Copies what was arranged in a local authoring demo into demo/fixtures.
// Start the demo with NASDASH_DEMO_AUTHORING_DIR (see demo/README.md), edit it in
// the browser, then run `npm run demo:authoring:apply`. Review the diff before committing.
import fs from 'node:fs';
import path from 'node:path';

const source = path.resolve(process.argv[2] || process.env.NASDASH_DEMO_AUTHORING_DIR || '.project-local/demo-authoring');
const fixtures = path.resolve('demo/fixtures');
const read = file => JSON.parse(fs.readFileSync(file, 'utf-8'));
const write = (name, value) => {
  const target = path.join(fixtures, name);
  // Untouched files keep their hand formatting.
  if (fs.existsSync(target) && JSON.stringify(read(target)) === JSON.stringify(value)) return;
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  console.log(`[NASDASH] Updated demo/fixtures/${name}`);
};

if (!fs.existsSync(source)) {
  console.error(`[NASDASH] Nothing recorded in ${source}. Edit the authoring demo first.`);
  process.exit(1);
}

const pagesFile = path.join(source, 'pages.json');
if (fs.existsSync(pagesFile)) write('pages.json', read(pagesFile));

const configFile = path.join(source, 'config.json');
if (fs.existsSync(configFile)) {
  const recorded = read(configFile);
  const { networkTopology, ...settings } = recorded.settings ?? {};
  // Only the look and layout come back: integrations, devices and hosts stay as written in the fixtures.
  const config = read(path.join(fixtures, 'config.json'));
  write('config.json', { ...config, settings: { ...config.settings, ...settings } });
  if (Array.isArray(recorded.categories)) write('services.json', recorded.categories);
  if (networkTopology && typeof networkTopology === 'object') write('topology.json', networkTopology);
}
