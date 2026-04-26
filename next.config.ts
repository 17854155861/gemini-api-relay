import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 启用 standalone 输出模式，用于生产环境部署
  output: 'standalone',
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),  // Uncomment and add 'import path from "path"' if needed
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
