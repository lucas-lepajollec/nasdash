import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Explicit destinations keep this command useful in independent clones.
const args = process.argv.slice(2);
const targets = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--landing', '--docs'].includes(args[i]) || !args[i + 1]) {
    throw new Error('Usage: node scripts/sync-demo-screenshots.mjs --landing PATH --docs PATH');
  }
  targets[args[i].slice(2)] = path.resolve(args[i + 1]);
}
if (!Object.keys(targets).length) throw new Error('Provide --landing and/or --docs.');
const source = path.resolve('docs/assets/screenshots');
const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
const version = JSON.parse(await fs.readFile('package.json', 'utf8')).version;
if (manifest.productVersion !== version) throw new Error('Regenerate screenshots for the current version first.');
const buffers = new Map();
for (const shot of manifest.shots) {
  if (!/^nasdash-demo-[a-z-]+\.jpg$/.test(shot.file)) throw new Error('Invalid capture filename.');
  const buffer = await fs.readFile(path.join(source, shot.file));
  if (crypto.createHash('sha256').update(buffer).digest('hex') !== shot.sha256) {
    throw new Error(`Capture does not match manifest: ${shot.file}`);
  }
  buffers.set(shot.file, buffer);
}
for (const [kind, target] of Object.entries(targets)) {
  // Validate all target repositories before writing any destination.
  const pkg = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'));
  if ((kind === 'docs' && pkg.name !== 'nasdash-documentation') || (kind === 'landing' && pkg.name !== 'nasdash')) {
    throw new Error(`Unexpected ${kind} repository.`);
  }
}
if (targets.landing) {
  const publicDir = path.join(targets.landing, 'public');
  const home = manifest.shots.find(shot => shot.file === 'nasdash-demo-home.jpg');
  const publicFilename = `nasdash-demo-home-${home.sha256.slice(0, 12)}.jpg`;
  await fs.writeFile(path.join(publicDir, publicFilename), buffers.get('nasdash-demo-home.jpg'));
  await fs.writeFile(path.join(publicDir, 'nasdash-demo-home.jpg'), buffers.get('nasdash-demo-home.jpg'));
  await fs.copyFile('public/nasdash.png', path.join(publicDir, 'nasdash-dashboard.png'));
  // Every locale shares the hero image and its actual intrinsic dimensions.
  for (const file of ['src/app/page.tsx', 'src/app/layout.tsx', 'src/lib/i18n.ts']) {
    const destination = path.join(targets.landing, file);
    const content = (await fs.readFile(destination, 'utf8')).replace(/nasdash-demo-home(?:-[a-f0-9]{12})?\.jpg/g, publicFilename);
    const updated = file.endsWith('page.tsx')
      ? content.replace(/(src="\/nasdash-demo-home-[a-f0-9]{12}\.jpg"[^>]*width=\{)\d+(\} height=\{)\d+(\})/, (match, beforeWidth, beforeHeight, end) => `${beforeWidth}${home.width}${beforeHeight}${home.height}${end}`)
      : content.replace(/(url: ['"]\/nasdash-demo-home-[a-f0-9]{12}\.jpg['"], width: )\d+(, height: )\d+/, (match, beforeWidth, beforeHeight) => `${beforeWidth}${home.width}${beforeHeight}${home.height}`);
    await fs.writeFile(destination, updated);
  }
  const readmePath = path.join(targets.landing, 'README.md');
  const readme = await fs.readFile(readmePath, 'utf8');
  await fs.writeFile(readmePath, readme.replace(/nasdash-demo-home(?:-[a-f0-9]{12})?\.jpg/g, publicFilename));
  console.log('[NASDASH] Synced landing hero, social previews and legacy PNG.');
}
if (targets.docs) {
  const destination = path.join(targets.docs, 'public', 'screenshots');
  await fs.mkdir(destination, { recursive: true });
  for (const [file, buffer] of buffers) await fs.writeFile(path.join(destination, file), buffer);
  await fs.copyFile(path.join(source, 'manifest.json'), path.join(destination, 'manifest.json'));
  console.log(`[NASDASH] Synced ${buffers.size} documentation screenshots and source manifest.`);
}
