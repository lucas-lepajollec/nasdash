import { afterEach, describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';
import {
  getDemoContainerState,
  getDemoSessionCustomTabs,
  isDemoContainerRemoved,
  isDemoImageRemoved,
  isDemoVolumeRemoved,
  removeDemoContainer,
  removeDemoImage,
  removeDemoVolume,
  setDemoContainerState,
  setDemoSessionCustomTabs,
  withDemoSession,
} from './demoSession';

const previousDemoMode = process.env.NASDASH_DEMO_MODE;

afterEach(() => {
  if (previousDemoMode === undefined) delete process.env.NASDASH_DEMO_MODE;
  else process.env.NASDASH_DEMO_MODE = previousDemoMode;
});

function sessionCookie(response: NextResponse): string {
  return response.headers.get('set-cookie')?.split(';')[0] || '';
}

describe('interactive demo sessions', () => {
  it('keeps temporary changes isolated per browser cookie', async () => {
    process.env.NASDASH_DEMO_MODE = 'true';

    const firstResponse = await withDemoSession(
      new Request('http://localhost/api/config'),
      async () => {
        setDemoSessionCustomTabs({ title: 'first browser' });
        return NextResponse.json({ ok: true });
      },
    );
    const firstCookie = sessionCookie(firstResponse);
    expect(firstCookie).toContain('nasdash_demo_session=');

    const persisted = await withDemoSession(
      new Request('http://localhost/api/config', { headers: { cookie: firstCookie } }),
      async () => NextResponse.json(getDemoSessionCustomTabs()),
    );
    expect(await persisted.json()).toEqual({ title: 'first browser' });

    const isolated = await withDemoSession(
      new Request('http://localhost/api/config'),
      async () => NextResponse.json(getDemoSessionCustomTabs()),
    );
    expect(await isolated.json()).toBeNull();
  });

  it('uses the same simulated state for short and full Docker ids', async () => {
    process.env.NASDASH_DEMO_MODE = 'true';

    const response = await withDemoSession(
      new Request('http://localhost/api/docker/mock-host/containers/mock11111111111111111111111111111111'),
      async () => {
        setDemoContainerState('mock11111111111111111111111111111111', 'exited');
        return NextResponse.json({ state: getDemoContainerState('mock11111111', 'running') });
      },
    );

    expect(await response.json()).toEqual({ state: 'exited' });
  });

  it('keeps simulated Docker deletions isolated in the current session', async () => {
    process.env.NASDASH_DEMO_MODE = 'true';

    const response = await withDemoSession(
      new Request('http://localhost/api/docker/mock-host'),
      async () => {
        removeDemoContainer('mock11111111000000000000000000000000');
        removeDemoImage('image-one');
        removeDemoVolume('volume-one');
        return NextResponse.json({
          container: isDemoContainerRemoved('mock11111111'),
          image: isDemoImageRemoved('image-one'),
          volume: isDemoVolumeRemoved('volume-one'),
        });
      },
    );

    expect(await response.json()).toEqual({ container: true, image: true, volume: true });
  });
});
