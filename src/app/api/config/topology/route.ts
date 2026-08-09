import { NextResponse } from 'next/server';
import { readConfig, writeTopology } from '@/lib/config';
import { checkAdmin } from '@/lib/auth';
import { checkReadAccess, READ_ACCESS } from '@/lib/access';

export const dynamic = 'force-dynamic';

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
    const body = await req.json();
    const topology = body.networkTopology !== undefined ? body.networkTopology : body;
    
    writeTopology(topology);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Erreur API Topology PUT:', e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
