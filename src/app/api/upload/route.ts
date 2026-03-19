import { NextRequest, NextResponse } from 'next/server';
import { getLogosDir } from '@/lib/config';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name).toLowerCase();
  const allowed = ['.png', '.svg', '.jpg', '.jpeg', '.webp', '.ico'];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(getLogosDir(), safeName);
  fs.writeFileSync(filePath, buffer);

  return NextResponse.json({ filename: safeName, url: `/api/logos/${safeName}` });
}
