import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Missing calendar URL' }, { status: 400 });
    }

    // Use dynamic import to prevent Next.js static evaluation from crashing
    const ical = require('node-ical');

    // Fetch and parse the ICS file
    const eventsData = await ical.async.fromURL(url);

    // Process events
    const processedEvents = [];
    const now = new Date();
    
    // Some iCal properties might be custom objects, so we need a robust extraction
    for (const rawEvent of Object.values(eventsData)) {
      const event: any = rawEvent;
      if (event && event.type === 'VEVENT') {
        processedEvents.push({
          id: event.uid,
          title: event.summary,
          start: event.start ? new Date(event.start).toISOString() : null,
          end: event.end ? new Date(event.end).toISOString() : null,
          description: event.description,
          location: event.location,
          isAllDay: event.datetype === 'date'
        });
      }
    }

    return NextResponse.json({ events: processedEvents });

  } catch (error: any) {
    console.error('Error fetching calendar:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar: ' + error.message }, { status: 500 });
  }
}
