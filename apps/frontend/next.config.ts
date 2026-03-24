import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use standalone output in production builds
  ...(process.env.NODE_ENV === 'production' && { output: 'standalone' }),

  // Turbopack config (Next.js 16+)
  // shiki's dynamic imports work without additional configuration
  turbopack: {},
};

export default nextConfig;
