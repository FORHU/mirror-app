/** @type {import('next').NextConfig} */

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["localhost:3000", "192.168.100.9:3000"],
  async rewrites() {
    return [
      {
        source: '/api/remote/:path*',
        destination: `${API_BASE_URL}/api/remote/:path*`,
      },
      {
        source: '/api/mirror/:path*',
        destination: `${API_BASE_URL}/api/mirror/:path*`,
      },
    ];
  },
};

export default nextConfig;
