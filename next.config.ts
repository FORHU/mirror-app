/** @type {import('next').NextConfig} */

// Strip /api suffix so rewrites don't double it: http://host:3007/api/ → http://host:3007
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Prevent webpack from bundling AWS SDK packages — they must run as native
  // Node.js requires in the API routes (HTTP/2 streaming, crypto, etc.)
  serverExternalPackages: [
    "@aws-sdk/client-transcribe-streaming",
    "@aws-sdk/client-polly",
  ],
  allowedDevOrigins: [
    "localhost:3000",
    "192.168.100.9:3000",
    "192.168.1.31:3000",
  ],
  async rewrites() {
    return [
      {
        source: "/api/mirror/:path*",
        destination: `${API_BASE_URL}/api/mirror/:path*`,
      },
    ];
  },
};

export default nextConfig;
