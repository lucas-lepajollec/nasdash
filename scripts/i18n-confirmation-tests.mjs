import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('the interface gate rejects raw confirmation labels, including object props', () => {
  const directory = mkdtempSync(join(process.cwd(), 'src', 'i18n-check-fixture-'));
  try {
    const fixture = join(directory, 'Confirm.tsx');
    writeFileSync(fixture, `export const Fixture = () => <ConfirmModal confirmLabel="Supprimer" cancelLabel={'Annuler'} {...{confirmLabel: 'Delete', cancelLabel: 'Cancel'}} />;`);
    const result = spawnSync(process.execPath, ['scripts/check-i18n.mjs'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    for (const label of ['confirmLabel attribute', 'cancelLabel attribute', 'confirmLabel property', 'cancelLabel property']) {
      assert.ok(result.stderr.includes(label), result.stderr);
    }
    writeFileSync(fixture, `export const Fixture = () => <ConfirmModal confirmLabel={t('Supprimer')} cancelLabel={t('Annuler')} />;`);
    const translated = spawnSync(process.execPath, ['scripts/check-i18n.mjs'], { encoding: 'utf8' });
    assert.equal(translated.status, 0, translated.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
