import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    const noStore = [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }]
    return [
      { source: '/', headers: noStore },
      { source: '/cockpit', headers: noStore },
      { source: '/login', headers: noStore },
      { source: '/legacy', headers: noStore },
      { source: '/outreach', headers: noStore },
      { source: '/center.html', headers: noStore },
    ]
  },
  async rewrites() {
    return [{ source: '/outreach', destination: '/center.html' }]
  },
};

export default nextConfig;
