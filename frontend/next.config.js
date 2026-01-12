/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use 'export' for static S3 deployment, 'standalone' for server deployment
  output: process.env.NEXT_EXPORT ? 'export' : 'standalone',
  // Disable image optimization for static export
  images: {
    unoptimized: true
  },
  // Trailing slash for S3 compatibility
  trailingSlash: true,
  // Performance optimizations
  swcMinify: true, // Use SWC minifier (faster and smaller bundles)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep errors and warnings
    } : false,
  },
  // Optimize bundle size
  experimental: {
    optimizeCss: true, // Optimize CSS
  },
  // Skip type checking during build (faster builds)
  typescript: {
    ignoreBuildErrors: false
  },
  // Skip ESLint during build (faster builds, run lint separately)
  eslint: {
    ignoreDuringBuilds: false
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
    NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
    NEXT_PUBLIC_COGNITO_REGION: process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1',
    NEXT_PUBLIC_COGNITO_DOMAIN: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '',
    NEXT_PUBLIC_SAML_PROVIDER_NAME: process.env.NEXT_PUBLIC_SAML_PROVIDER_NAME || ''
  }
}

module.exports = nextConfig

