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
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const current = searchParams.get('current');
    const currentTablet = searchParams.get('currentTablet');
    const currentMobile = searchParams.get('currentMobile');

    const files = fs.readdirSync(dir);
    
    // Filter for image files
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico'];
    const images = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        if (!imageExtensions.includes(ext)) return false;

        const fileUrl = `/api/logos/${file}`;
        
        // If query wants backgrounds, keep bg_ prefix or the currently selected background
        if (type === 'background') {
          return file.startsWith('bg_') || (current && fileUrl === current) || (currentTablet && fileUrl === currentTablet) || (currentMobile && fileUrl === currentMobile);
        }

        // Otherwise (listing logos), hide files that start with bg_ prefix
        return !file.startsWith('bg_');
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
