import { NextRequest, NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { readBoundedResponseBytes, ResponseTooLargeError } from '@/lib/boundedResponse';

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

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Missing calendar URL' }, { status: 400 });
    }

    // Prévention SSRF: Valider que l'URL demandée est bien celle configurée par l'admin
    const configUrl = config.settings?.calendarUrl;
    if (url !== configUrl) {
      return NextResponse.json({ error: 'Accès non autorisé à cette URL.' }, { status: 403 });
    }

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

    // Simple native iCal parser to avoid Next.js node-ical crashes (BigInt errors)
    const processedEvents = [];
    const eventBlocks = textData.split('BEGIN:VEVENT');
    
    // Skip the first block as it's just the VCALENDAR header
    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i].split('END:VEVENT')[0];
      
      const extractField = (fieldName: string) => {
        const regex = new RegExp(`^${fieldName}[^:]*:(.*)$`, 'm');
        const match = block.match(regex);
        return match ? match[1].trim() : null;
      };

      const uid = extractField('UID');
      const summary = extractField('SUMMARY');
      const start = extractField('DTSTART');
      const end = extractField('DTEND');
      const description = extractField('DESCRIPTION');
      const location = extractField('LOCATION');

      if (summary && start) {
        // Format dates (handle basic iCal date strings like 20260524 or 20260524T120000Z)
        const formatDate = (ds: string) => {
          if (!ds) return null;
          if (ds.length === 8) {
            return new Date(`${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}T00:00:00Z`).toISOString();
          }
          if (ds.includes('T')) {
            const datePart = ds.split('T')[0];
            const timePart = ds.split('T')[1].replace('Z', '');
            return new Date(`${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}T${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}Z`).toISOString();
          }
          return null;
        };

        const isAllDay = start.length === 8;
        
        processedEvents.push({
          id: uid || Math.random().toString(),
          title: summary,
          start: formatDate(start),
          end: end ? formatDate(end) : null,
          description,
          location,
          isAllDay
        });
      }
    }

    return NextResponse.json({ events: processedEvents });

  } catch (error: unknown) {
    if (error instanceof ResponseTooLargeError) {
      return NextResponse.json({ error: 'Le calendrier dépasse la taille autorisée (2 Mo).' }, { status: 413 });
    }
    console.error('Error fetching calendar:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch calendar: ' + message }, { status: 500 });
  }
}
