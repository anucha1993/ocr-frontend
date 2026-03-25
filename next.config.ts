import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Required for custom server.js (Plesk Node.js hosting)
  // Do NOT use output: 'standalone' — it changes the file structure
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
