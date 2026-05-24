import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Missing calendar URL' }, { status: 400 });
    }

    // Fetch natively
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ICS: ${response.status} ${response.statusText}`);
    }
    const textData = await response.text();

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
      let start = extractField('DTSTART');
      let end = extractField('DTEND');
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

  } catch (error: any) {
    console.error('Error fetching calendar:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar: ' + error.message }, { status: 500 });
  }
}
