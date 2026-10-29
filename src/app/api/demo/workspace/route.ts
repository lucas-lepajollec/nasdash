import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demoMode';
import { runDemoWorkspace, type DemoWorkspace } from '@/lib/demoSession';
import { recordDemoAuthoring } from '@/lib/demoAuthoring';
import { readJsonObject, readEnum, readString, isJsonObject, RequestValidationError } from '@/lib/requestValidation';
import * as config from '@/app/api/config/route';
import * as pages from '@/app/api/pages/route';
import * as calendar from '@/app/api/config/calendar/route';
import * as topology from '@/app/api/config/topology/route';
import * as containers from '@/app/api/docker/[hostId]/containers/route';
import * as container from '@/app/api/docker/[hostId]/containers/[id]/route';
import * as logs from '@/app/api/docker/[hostId]/containers/[id]/logs/route';
import * as images from '@/app/api/docker/[hostId]/images/route';
import * as device from '@/app/api/devices/[id]/route';
import * as history from '@/app/api/devices/[id]/history/route';
import * as volumes from '@/app/api/docker/[hostId]/volumes/route';

export const dynamic = 'force-dynamic';
type Handler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** A bounded stateless transport for fictional demo edits, unavailable on installations. */
export async function POST(request: NextRequest) {
  if (!isDemoMode()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const payload = await readJsonObject(request, 2 * 1024 * 1024);
    const method = readEnum(payload, 'method', ['GET', 'POST', 'PUT', 'DELETE'] as const, true)!;
    const target = readString(payload, 'path', { required: true, maxLength: 2048 })!;
    if (!target.startsWith('/api/') || target.startsWith('//')) throw new RequestValidationError('Invalid demo path');
    const url = new URL(target, 'http://demo.invalid');
    let routes: object | undefined;
    let params: Record<string, string> = {};
    if (url.pathname === '/api/config') routes = config;
    else if (url.pathname === '/api/pages') routes = pages;
    else if (url.pathname === '/api/config/calendar') routes = calendar;
    else if (url.pathname === '/api/config/topology') routes = topology;
    else if (/^\/api\/devices\/[^/]+(?:\/history)?$/.test(url.pathname)) {
      params = { id: decodeURIComponent(url.pathname.split('/')[3]) };
      routes = url.pathname.endsWith('/history') ? history : device;
    } else {
      const match = url.pathname.match(/^\/api\/docker\/([^/]+)\/(containers|images|volumes)(?:\/([^/]+)(?:\/(logs))?)?$/);
      if (match) {
        params = { hostId: decodeURIComponent(match[1]), ...(match[3] ? { id: decodeURIComponent(match[3]) } : {}) };
        routes = match[2] === 'images' && !match[3] ? images : match[2] === 'volumes' && !match[3] ? volumes : match[2] === 'containers' ? (match[4] ? logs : match[3] ? container : containers) : undefined;
      }
    }
    const handler = (routes as Record<string, Handler> | undefined)?.[method];
    if (!handler) return NextResponse.json({ error: 'Unsupported demo request' }, { status: 404 });
    if (!isJsonObject(payload.workspace)) throw new RequestValidationError('Invalid demo workspace');
    const workspace = payload.workspace as DemoWorkspace;
    for (const values of [workspace.containerStates, workspace.removedContainers, workspace.removedImages, workspace.removedVolumes]) {
      if (values !== undefined && (!Array.isArray(values) || values.length > 2000)) throw new RequestValidationError('Invalid demo state');
    }
    if (workspace.config && (!isJsonObject(workspace.config) || !isJsonObject(workspace.config.settings))) throw new RequestValidationError('Invalid demo config');
    const innerRequest = new NextRequest(url, { method, headers: { 'Content-Type': 'application/json' }, ...(method !== 'GET' && payload.body !== undefined ? { body: JSON.stringify(payload.body) } : {}) });
    const answer = await runDemoWorkspace(workspace, async () => {
      const response = await handler(innerRequest, { params: Promise.resolve(params) });
      return { status: response.status, body: await response.json() };
    });
    if (method !== 'GET' && answer.result.status < 400) recordDemoAuthoring(answer.workspace);
    return NextResponse.json(answer, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof RequestValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Invalid demo workspace' }, { status: 400 });
  }
}
