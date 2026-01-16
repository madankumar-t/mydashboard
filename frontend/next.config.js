/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ REQUIRED for static hosting (S3 / CloudFront)
  output: 'export',

  // ✅ Required for static export
  images: {
    unoptimized: true,
  },

  // ✅ Required for S3 routing
  trailingSlash: true,

  swcMinify: true,

  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },

  // 🔴 MUST BE FALSE — otherwise Next.js tries to load "critters"
  experimental: {
    optimizeCss: false,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
