import { NextResponse } from 'next/server';
import { readConfig, writeCalendar } from '@/lib/config';
import { v4 as uuidv4 } from 'uuid';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = readConfig();
  return NextResponse.json(config.localEvents || []);
}

export async function POST(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const config = readConfig();
    if (!config.localEvents) config.localEvents = [];

    const newEvent = {
      id: uuidv4(),
      title: body.title || 'Nouvel événement',
      start: body.start,
      end: body.end,
      description: body.description,
      isAllDay: body.isAllDay || false
    };

    config.localEvents.push(newEvent);
    writeCalendar(config.localEvents);

    return NextResponse.json(newEvent, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const config = readConfig();
    if (!config.localEvents) config.localEvents = [];

    const event = config.localEvents.find((e: any) => e.id === body.id);
    if (!event) return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });

    if (body.title !== undefined) event.title = body.title;
    if (body.start !== undefined) event.start = body.start;
    if (body.end !== undefined) event.end = body.end;
    if (body.description !== undefined) event.description = body.description;
    if (body.isAllDay !== undefined) event.isAllDay = body.isAllDay;

    writeCalendar(config.localEvents);
    return NextResponse.json(event);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

    const config = readConfig();
    if (!config.localEvents) config.localEvents = [];

    const filtered = config.localEvents.filter((e: any) => e.id !== id);
    writeCalendar(filtered);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
