import { NextRequest, NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { readBoundedResponseBytes, ResponseTooLargeError } from '@/lib/boundedResponse';
import { isDemoMode } from '@/lib/demoMode';
import { CalendarParseError, parseCalendarIcs } from '@/lib/calendarIcs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const config = readConfig();
    const access = checkReadAccess(
      request,
      config.settings?.securityMode || 'public',
      READ_ACCESS.calendar
    );
    if (access.error) return access.error;

    // Never let a public demo visitor turn this endpoint into an outbound
    // fetcher. Local fixture events are already merged by CalendarWidget.
    if (isDemoMode()) {
      return NextResponse.json({ events: [], simulated: true });
    }

    const { searchParams } = new URL(request.url);
    // Resolve the capability URL on the server. Optional legacy callers may only
    // supply the exact configured address; readers never receive it in config.
    const configUrl = config.settings?.calendarUrl;
    const requestedUrl = searchParams.get('url');
    if (requestedUrl && requestedUrl !== configUrl) return NextResponse.json({ error: 'calendar.accessDenied' }, { status: 403 });
    if (!configUrl) return NextResponse.json({ events: [] });
    const url = configUrl;

    let calendarUrl: URL;
    try {
      calendarUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL de calendrier invalide.' }, { status: 400 });
    }
    if (!['http:', 'https:'].includes(calendarUrl.protocol)) {
      return NextResponse.json({ error: 'Protocole de calendrier non autorisé.' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(calendarUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch ICS: ${response.status} ${response.statusText}`);
    }

    const calendarBuffer = await readBoundedResponseBytes(response, 2 * 1024 * 1024);
    const textData = new TextDecoder().decode(calendarBuffer);

    return NextResponse.json({ events: parseCalendarIcs(textData) }, { headers: { 'Cache-Control': 'private, no-store' } });

  } catch (error: unknown) {
    if (error instanceof CalendarParseError) return NextResponse.json({ error: error.key }, { status: 422 });
    if (error instanceof ResponseTooLargeError) {
      return NextResponse.json({ error: 'Le calendrier dépasse la taille autorisée (2 Mo).' }, { status: 413 });
    }
    // Provider addresses can contain bearer capabilities: never log the URL/error cause.
    console.error('[NASDASH] Calendar download failed.');
    return NextResponse.json({ error: 'calendar.fetchFailed' }, { status: 502 });
  }
}
