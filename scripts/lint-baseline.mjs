import { ESLint } from 'eslint';

// Temporary debt ceiling. Each count may only decrease; any new error rule or
// increase fails CI. Remove entries as the corresponding legacy code is fixed.
const baseline = new Map([
  ['@typescript-eslint/no-explicit-any', 123],
  ['react-hooks/set-state-in-effect', 16],
  ['prefer-const', 8],
  ['react/no-unescaped-entities', 3],
  ['@typescript-eslint/no-require-imports', 2],
  ['react-hooks/preserve-manual-memoization', 2],
  ['@typescript-eslint/ban-ts-comment', 1],
]);

const eslint = new ESLint();
const report = await eslint.lintFiles([
  'src',
  'scripts',
  'next.config.ts',
  'eslint.config.mjs',
]);

const current = new Map();
for (const file of report) {
  for (const message of file.messages || []) {
    if (message.severity !== 2) continue;
    const rule = message.ruleId || 'fatal/parser-error';
    current.set(rule, (current.get(rule) || 0) + 1);
  }
}

const failures = [];
for (const [rule, count] of current) {
  const limit = baseline.get(rule) ?? 0;
  if (count > limit) failures.push(`${rule}: ${count} errors (ceiling ${limit})`);
}

const summary = [...current.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([rule, count]) => `${rule}=${count}`)
  .join(', ');
console.log(`ESLint debt: ${summary || 'zero errors'}`);

if (failures.length) {
  console.error('The lint debt ceiling increased:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Lint debt did not increase.');
