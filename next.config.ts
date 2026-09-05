import type { NextConfig } from 'next';

const allowedDevOrigins = [
  'localhost',
  '127.0.0.1',
  ...(process.env.NASDASH_ALLOWED_DEV_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
];

// Trigger dev server restart to reload background monitoring loop
const nextConfig: NextConfig = {
  // Docker/self-hosted releases use Next's minimal standalone server. Vercel
  // creates its own Functions and build output, so asking Next for both output
  // formats can leave Vercel's post-build tracer without the manifest it
  // expects. VERCEL=1 is provided by the platform at build time.
  output: process.env.VERCEL === '1' ? undefined : 'standalone',
  outputFileTracingIncludes: {
    '/*': ['./demo/fixtures/**/*'],
  },
  distDir: process.env.NASDASH_NEXT_DIST_DIR || '.next',
  agentRules: false,
  serverExternalPackages: ['systeminformation'],
  allowedDevOrigins,
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];

    if (process.env.NASDASH_DEMO_MODE === 'true') {
      securityHeaders.push({
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow, noarchive',
      });
    }

    return [{
      source: '/:path*',
      headers: securityHeaders,
    }];
  },
};

export default nextConfig;
