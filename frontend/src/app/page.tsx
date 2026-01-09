'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredSession, loginWithHostedUI } from '@/lib/auth'
import { Box, CircularProgress, Typography, Alert } from '@mui/material'

export default function Home() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Wait for client-side hydration
    setMounted(true)

    // Enhanced logging for production debugging
    console.log('🏠 Home page mounted');
    console.log('🏠 Current URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
    console.log('🏠 Origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A');

    // Check for existing session
    const session = getStoredSession()
    console.log('🏠 Session check:', session ? 'Found' : 'Not found');
    
    // Add 5 minute buffer before expiration
    const expirationBuffer = 5 * 60 * 1000 // 5 minutes in milliseconds
    if (session && session.expiresAt && session.expiresAt > Date.now() + expirationBuffer) {
      // User is already authenticated, redirect to dashboard
      console.log('✅ Valid session found, redirecting to dashboard');
      router.push('/dashboard')
      return
    }

    // No valid session - automatically redirect to Cognito
    // Small delay to ensure component is mounted
    console.log('🔄 No valid session, redirecting to Cognito...');
    const redirectTimer = setTimeout(() => {
      try {
        loginWithHostedUI()
      } catch (err) {
        console.error('❌ Failed to redirect to Cognito:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to initiate login. Please check browser console for details.';
        setError(errorMessage);
        // Log diagnostic info
        console.error('❌ Diagnostic Info:', {
          origin: window.location.origin,
          cognitoDomain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || 'MISSING',
          cognitoClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ? 'SET' : 'MISSING',
          cognitoRegion: process.env.NEXT_PUBLIC_COGNITO_REGION || 'MISSING'
        });
      }
    }, 100)

    return () => clearTimeout(redirectTimer)
  }, [router])

  // Show minimal loading screen while checking/redirecting
  // This prevents flash of content before redirect
  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={2}
        p={3}
      >
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Configuration Error
          </Typography>
          <Typography variant="body2">{error}</Typography>
          <Typography variant="body2" sx={{ mt: 2, fontSize: '0.875rem' }}>
            <strong>Common causes:</strong>
            <br />• Environment variables not set at build time
            <br />• Cognito callback URL mismatch
            <br />• Check browser console for details
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <CircularProgress />
    </Box>
  )
}

