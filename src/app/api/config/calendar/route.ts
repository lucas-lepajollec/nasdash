import { NextResponse } from 'next/server';
import { readConfig, writeCalendar } from '@/lib/config';
import { v4 as uuidv4 } from 'uuid';
import { checkAdmin } from '@/lib/auth';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import {
  RequestValidationError,
  assertSafeIdentifier,
  readBoolean,
  readJsonObject,
  readString,
} from '@/lib/requestValidation';

export const dynamic = 'force-dynamic';
const MAX_CALENDAR_BODY_BYTES = 64 * 1024;

function validationResponse(error: unknown) {
  if (error instanceof RequestValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  const config = readConfig();
  const access = checkReadAccess(
    req,
    config.settings?.securityMode || 'public',
    READ_ACCESS.calendar
  );
  if (access.error) return access.error;

  return NextResponse.json(config.localEvents || []);
}

export async function POST(req: Request) {
  const authError = checkAdmin(req);
  if (authError) return authError;


  try {
    const body = await readJsonObject(req, MAX_CALENDAR_BODY_BYTES);
    const config = readConfig();
    if (!config.localEvents) config.localEvents = [];

    const title = readString(body, 'title', { maxLength: 200 });
    const start = readString(body, 'start', { required: true, maxLength: 64 })!;
    const end = readString(body, 'end', { maxLength: 64 });
    const description = readString(body, 'description', { maxLength: 4000 });
    const isAllDay = readBoolean(body, 'isAllDay');

    const newEvent = {
      id: uuidv4(),
      title: title || 'Nouvel événement',
      start,
      end,
      description,
      isAllDay: isAllDay || false
    };

    config.localEvents.push(newEvent);
    writeCalendar(config.localEvents);

    return NextResponse.json(newEvent, { status: 201 });
  } catch (e: unknown) {
    const response = validationResponse(e);
    if (response) return response;
    console.error('Erreur API Calendar POST:', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const authError = checkAdmin(req);
  if (authError) return authError;


  try {
    const body = await readJsonObject(req, MAX_CALENDAR_BODY_BYTES);
    const id = assertSafeIdentifier(readString(body, 'id', { required: true, maxLength: 128 })!);
    const config = readConfig();
    if (!config.localEvents) config.localEvents = [];

    const event = config.localEvents.find(e => e.id === id);
    if (!event) return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });

    const title = readString(body, 'title', { maxLength: 200 });
    const start = readString(body, 'start', { maxLength: 64 });
    const end = readString(body, 'end', { maxLength: 64 });
    const description = readString(body, 'description', { maxLength: 4000 });
    const isAllDay = readBoolean(body, 'isAllDay');

    if (title !== undefined) event.title = title;
    if (start !== undefined) event.start = start;
    if (end !== undefined) event.end = end;
    if (description !== undefined) event.description = description;
    if (isAllDay !== undefined) event.isAllDay = isAllDay;

    writeCalendar(config.localEvents);
    return NextResponse.json(event);
  } catch (e: unknown) {
    const response = validationResponse(e);
    if (response) return response;
    console.error('Erreur API Calendar PUT:', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authError = checkAdmin(req);
  if (authError) return authError;


  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    assertSafeIdentifier(id);

    const config = readConfig();
    if (!config.localEvents) config.localEvents = [];

    const filtered = config.localEvents.filter(e => e.id !== id);
    writeCalendar(filtered);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const response = validationResponse(e);
    if (response) return response;
    console.error('Erreur API Calendar DELETE:', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}
