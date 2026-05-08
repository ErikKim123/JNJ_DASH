import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // typedRoutes는 동적 세그먼트 사용이 많아 비활성화 (Design §7 — search params 사용)
};

export default nextConfig;
