import { NextRequest, NextResponse } from 'next/server';
import { getLogosDir } from '@/lib/config';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const dir = getLogosDir();
    if (!fs.existsSync(dir)) {
      return NextResponse.json({ files: [] });
    }
    const files = fs.readdirSync(dir);
    
    // Filter for image files
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico'];
    const images = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .map((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        return {
          name: file,
          url: `/api/logos/${file}`,
          mtime: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    return NextResponse.json({ files: images });
  } catch (error) {
    console.error('Failed to list background images:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
