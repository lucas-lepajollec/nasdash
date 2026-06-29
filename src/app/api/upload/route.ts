import { NextRequest, NextResponse } from 'next/server';
import { getLogosDir } from '@/lib/config';
import { verifyToken } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

function checkAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('nasdash_session')?.value;
  if (!token) return false;
  const payload = verifyToken(token);
  return payload?.role === 'admin';
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  // Limitation de taille à 5 Mo
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Le fichier dépasse la limite autorisée (5 Mo).' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name).toLowerCase();
  const allowed = ['.png', '.svg', '.jpg', '.jpeg', '.webp', '.ico'];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
  }

  const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
  const prefix = type === 'background' ? 'bg_' : '';
  const safeName = `${prefix}${baseName}_${Date.now()}${ext}`;
  const filePath = path.join(getLogosDir(), safeName);
  fs.writeFileSync(filePath, buffer);

  return NextResponse.json({ filename: safeName, url: `/api/logos/${safeName}` });
}
