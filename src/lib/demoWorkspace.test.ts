import { afterEach, describe, expect, it } from 'vitest';
import { getDemoSessionConfig, setDemoSessionConfig, runDemoWorkspace, withDemoSession } from './demoSession';
import { NextResponse } from 'next/server';
const old = process.env.NASDASH_DEMO_MODE;
afterEach(() => { if (old === undefined) delete process.env.NASDASH_DEMO_MODE; else process.env.NASDASH_DEMO_MODE = old; });
describe('portable demo workspaces', () => {
 it('preserves edits across independent request contexts and does not share visitors', async () => {
  process.env.NASDASH_DEMO_MODE = 'true';
  const first = await runDemoWorkspace({}, async () => withDemoSession(new Request('http://localhost/api/config'), async () => {
   setDemoSessionConfig({ version:1, categories:[], settings:{ title:'Visitor A', showMonitor:true }, demoMode:true });
   return NextResponse.json({ ok:true });
  }));
  const second = await runDemoWorkspace(JSON.parse(JSON.stringify(first.workspace)), async () => getDemoSessionConfig());
  expect(second.result?.settings.title).toBe('Visitor A');
  expect((await runDemoWorkspace({}, async () => getDemoSessionConfig())).result).toBeNull();
 });
 it('never evicts in-flight portable requests under concurrent visitors', async () => {
  process.env.NASDASH_DEMO_MODE = 'true';
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const requests = Array.from({ length: 80 }, (_, index) => runDemoWorkspace({}, async () => {
    await barrier;
    setDemoSessionConfig({ version: 1, categories: [], settings: { title: `Visitor ${index}`, showMonitor: true }, demoMode: true });
    return index;
  }));
  release();
  const results = await Promise.all(requests);
  results.forEach((answer, index) => expect(answer.workspace.config?.settings.title).toBe(`Visitor ${index}`));
 });
 it('cannot run the portable workspace on an installed server', async () => {
  process.env.NASDASH_DEMO_MODE = 'false';
  await expect(runDemoWorkspace({}, async () => true)).rejects.toThrow('unavailable');
 });
});
