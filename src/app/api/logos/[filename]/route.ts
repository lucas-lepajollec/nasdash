import { NextRequest, NextResponse } from 'next/server';
import { getLogosDir, readConfig } from '@/lib/config';
import { checkAdmin } from '@/lib/auth';
import { resolveAccessPrincipal } from '@/lib/access';
import path from 'path';
import fs from 'fs';
import { isDemoMode } from '@/lib/demoMode';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const config = readConfig();
  const principal = resolveAccessPrincipal(req, config.settings?.securityMode || 'public');
  if (!principal) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const { filename } = await params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(getLogosDir(), safeFilename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = path.extname(safeFilename).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      ...(ext === '.svg' ? {
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      } : {}),
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: 'La suppression de fichiers est désactivée dans le bac à sable.' },
      { status: 403 },
    );
  }
  const authError = checkAdmin(req);
  if (authError) return authError;


  const { filename } = await params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(getLogosDir(), safeFilename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
