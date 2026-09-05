import type { MetadataRoute } from 'next';
import { isDemoMode } from '@/lib/demoMode';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isDemoMode()
      ? { userAgent: '*', disallow: '/' }
      : { userAgent: '*', allow: '/' },
  };
}
