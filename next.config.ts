import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  turbopack: {
    root: '.',
  },
};

export default nextConfig;
