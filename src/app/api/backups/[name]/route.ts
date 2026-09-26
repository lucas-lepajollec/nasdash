import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/auth';
import { isDemoMode } from '@/lib/demoMode';
import { backupPath, deleteBackup } from '@/lib/backups';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ name: string }> };

/** Downloads one backup (it holds every secret of the instance: admins only). */
export async function GET(request: NextRequest, { params }: Params) {
  const authError = checkAdmin(request);
  if (authError) return authError;
  if (isDemoMode()) return NextResponse.json({ error: 'backups.demoDisabled' }, { status: 403 });
  const { name } = await params;
  const file = backupPath(name);
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const data = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Length': String(data.length),
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const authError = checkAdmin(request);
  if (authError) return authError;
  if (isDemoMode()) return NextResponse.json({ error: 'backups.demoDisabled' }, { status: 403 });
  const { name } = await params;
  return deleteBackup(name) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
