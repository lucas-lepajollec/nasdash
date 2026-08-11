import { NextRequest, NextResponse } from 'next/server';
import { getLogosDir } from '@/lib/config';
import { checkAdmin } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;


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

  const hasSignature = (() => {
    if (ext === '.png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (ext === '.jpg' || ext === '.jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (ext === '.webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (ext === '.ico') return buffer.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00]));
    if (ext === '.svg') {
      const svg = buffer.toString('utf8');
      const isSvg = /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg);
      const containsActiveContent = /<script\b|<foreignObject\b|\son\w+\s*=|javascript\s*:|<!ENTITY\b/i.test(svg);
      return isSvg && !containsActiveContent;
    }
    return false;
  })();

  if (!hasSignature) {
    return NextResponse.json({ error: 'Le contenu du fichier ne correspond pas à un format d’image autorisé.' }, { status: 400 });
  }

  const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
  const prefix = type === 'background' ? 'bg_' : '';
  const safeName = `${prefix}${baseName}_${Date.now()}${ext}`;
  const filePath = path.join(getLogosDir(), safeName);
  fs.writeFileSync(filePath, buffer);

  return NextResponse.json({ filename: safeName, url: `/api/logos/${safeName}` });
}
