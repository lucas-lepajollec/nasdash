import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WIDGET_DEFINITIONS } from './definitions';

const root = path.join(process.cwd(), 'src', 'widgets');

describe('widget folders', () => {
  it('has one folder per definition, each with a view listed in views.ts', () => {
    const views = fs.readFileSync(path.join(root, 'views.ts'), 'utf8');
    for (const { type, sizes } of WIDGET_DEFINITIONS) {
      expect(fs.existsSync(path.join(root, type, 'definition.ts')), type).toBe(true);
      expect(fs.existsSync(path.join(root, type, 'view.tsx')), type).toBe(true);
      expect(views, type).toContain(`'${type}':`);
      // Sizes: sorted whole columns, the default being one of them.
      expect([...sizes.formats].sort((a, b) => a - b), type).toEqual(sizes.formats);
      expect(sizes.formats.every(size => Number.isInteger(size) && size >= 1 && size <= 24), type).toBe(true);
      expect(sizes.formats, type).toContain(sizes.default);
    }
    const folders = fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
    expect(folders.sort()).toEqual(WIDGET_DEFINITIONS.map(definition => definition.type).sort());
  });
});
