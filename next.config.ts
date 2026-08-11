import type { NextConfig } from 'next';

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
  allowedDevOrigins: ['192.168.0.201', '192.168.0.200', '192.168.0.204', '100.65.22.51', '100.81.228.93', 'localhost', '127.0.0.1'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default nextConfig;
