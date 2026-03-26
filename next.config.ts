import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  compress: true,
  // Proxy /backend-api/* → Laravel backend
  // ใช้เมื่อ Frontend และ Backend อยู่ domain เดียวกัน
  // ตั้งค่า NEXT_PUBLIC_API_URL=/backend-api ใน .env.production
  async rewrites() {
    const laravelUrl = process.env.LARAVEL_INTERNAL_URL;
    if (!laravelUrl) return [];
    return [
      {
        source: "/backend-api/:path*",
        destination: `${laravelUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
