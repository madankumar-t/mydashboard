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
    NEXT_PUBLIC_COGNITO_DOMAIN: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || ''
  }
}

module.exports = nextConfig

