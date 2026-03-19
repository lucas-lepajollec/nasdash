import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['systeminformation'],
  allowedDevOrigins: ['192.168.0.201', '192.168.0.200', '100.65.22.51', '100.81.228.93', 'localhost', '127.0.0.1'],
};

export default nextConfig;
