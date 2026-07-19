import { NextResponse } from 'next/server';
import { readConfig, writeTopology } from '@/lib/config';
import { checkAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = readConfig();
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
