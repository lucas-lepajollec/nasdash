import type { NextConfig } from 'next';

// Trigger dev server restart to reload background monitoring loop
const nextConfig: NextConfig = {
  output: 'standalone',
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
