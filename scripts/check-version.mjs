import fs from 'node:fs';

const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const version = packageJson.version;

if (!packageJson.private) throw new Error('The application package must stay private; NasDash is distributed as an app/container, not through npm.');
if (!semver.test(version)) throw new Error(`Invalid product version: ${version}`);
if (packageLock.version !== version || packageLock.packages?.['']?.version !== version) {
  throw new Error('package.json and package-lock.json product versions do not match.');
}

if (process.env.GITHUB_REF_TYPE === 'tag') {
  const expected = `v${version}`;
  if (process.env.GITHUB_REF_NAME !== expected) {
    throw new Error(`Release tag ${process.env.GITHUB_REF_NAME} does not match product version ${expected}.`);
  }
}

console.log(`NasDash version contract verified: ${version}`);
