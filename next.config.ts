/** @type {import('next').NextConfig} */

// Strip /api suffix so rewrites don't double it: http://host:3007/api/ → http://host:3007
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "",
  },
  output: "standalone",
  reactStrictMode: true,
  // Prevent webpack from bundling AWS SDK packages — they must run as native
  // Node.js requires in the API routes (HTTP/2 streaming, crypto, etc.)
  serverExternalPackages: [
    "@aws-sdk/client-transcribe-streaming",
    "@aws-sdk/client-polly",
  ],
  allowedDevOrigins: [
    "mirror-app-dev-1.forhu.ai",
    "mirror-app-dev-2.forhu.ai",
    "mirror1.forhu.ai",
    "mirror2.forhu.ai",
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
