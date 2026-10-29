import fs from 'node:fs';
import path from 'node:path';
import type { DemoWorkspace } from './demoSession';

/**
 * Authoring the demo by hand: with NASDASH_DEMO_AUTHORING_DIR set on a local
 * demo server, every change made in the browser is also saved to that folder,
 * and `npm run demo:authoring:apply` copies it into `demo/fixtures`. Never set
 * on the public demo: it would record visitors' edits.
 */
export function demoAuthoringDirectory(): string | null {
  const directory = process.env.NASDASH_DEMO_AUTHORING_DIR?.trim();
  return directory ? path.resolve(directory) : null;
}

export function recordDemoAuthoring(workspace: DemoWorkspace): void {
  const directory = demoAuthoringDirectory();
  if (!directory) return;
  try {
    fs.mkdirSync(directory, { recursive: true });
    const write = (name: string, value: unknown) => {
      if (value === undefined) return;
      const target = path.join(directory, name);
      fs.writeFileSync(`${target}.tmp`, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
      fs.renameSync(`${target}.tmp`, target);
    };
    write('config.json', workspace.config);
    write('pages.json', workspace.pages);
  } catch (error) {
    console.error('[NASDASH] Cannot record the demo authoring workspace', error);
  }
}
