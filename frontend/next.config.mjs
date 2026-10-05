/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Lint/type errors are enforced in CI via `npm run typecheck`; don't block
  // the production image build on eslint config presence.
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    // In local `next dev` (no nginx), proxy API calls to the backend so the
    // browser keeps talking to a single origin. In Docker, nginx handles this.
    if (API_URL.startsWith("/")) {
      return [
        {
          source: "/api/:path*",
          destination:
            (process.env.BACKEND_INTERNAL_URL || "http://localhost:8000") +
            "/api/:path*",
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
