import { NextResponse } from 'next/server';
import { readConfig, writeTopology } from '@/lib/config';
import { checkAdmin } from '@/lib/auth';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';
import { RequestValidationError, isJsonObject, readJsonObject } from '@/lib/requestValidation';

export const dynamic = 'force-dynamic';
const MAX_TOPOLOGY_BODY_BYTES = 1024 * 1024;

function validateTopology(value: unknown) {
  if (!isJsonObject(value)) {
    throw new RequestValidationError('La topologie doit être un objet.');
  }

  const limits = { nodes: 500, groups: 200, connections: 2000 } as const;
  for (const [key, limit] of Object.entries(limits)) {
    const collection = value[key];
    if (!Array.isArray(collection) || collection.some(item => !isJsonObject(item))) {
      throw new RequestValidationError(`Le champ « ${key} » doit être une liste d’objets.`);
    }
    if (collection.length > limit) {
      throw new RequestValidationError(`Le champ « ${key} » contient trop d’éléments.`, 413);
    }
  }

  return value;
}

export async function GET(req: Request) {
  const config = readConfig();
  const access = checkReadAccess(
    req,
    config.settings?.securityMode || 'public',
    READ_ACCESS.topology
  );
  if (access.error) return access.error;

  return NextResponse.json(config.settings?.networkTopology || { nodes: [], groups: [], connections: [] });
}

export async function PUT(req: Request) {
  const authError = checkAdmin(req);
  if (authError) return authError;


  try {
    const body = await readJsonObject(req, MAX_TOPOLOGY_BODY_BYTES);
    const topology = body.networkTopology !== undefined ? body.networkTopology : body;

    writeTopology(validateTopology(topology));
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof RequestValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('Erreur API Topology PUT:', e);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}
