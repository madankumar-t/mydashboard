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
    // CRITICAL: Only check once, don't redirect immediately to avoid loops
    const session = getStoredSession()
    console.log('🏠 Session check:', session ? 'Found' : 'Not found');
    
    if (session) {
      console.log('🏠 Session details:', {
        username: session.username,
        expiresAt: new Date(session.expiresAt).toISOString(),
        now: new Date().toISOString(),
        expiresIn: Math.round((session.expiresAt - Date.now()) / 1000 / 60) + ' minutes'
      })
    }
    
    // Add 5 minute buffer before expiration to avoid edge cases
    const expirationBuffer = 5 * 60 * 1000 // 5 minutes in milliseconds
    if (session && session.expiresAt && session.expiresAt > Date.now() + expirationBuffer) {
      // User is already authenticated, redirect to dashboard
      console.log('✅ Valid session found, redirecting to dashboard');
      // Use replace instead of push to avoid adding to history
      router.replace('/dashboard')
      return
    }

    // No valid session - automatically redirect to Cognito
    // IMPORTANT: Only redirect if we're sure there's no session
    // Add delay to prevent immediate redirect loops
    console.log('🔄 No valid session, redirecting to Cognito...');
    console.log('🔄 Current path:', window.location.pathname);
    console.log('🔄 Is callback page?', window.location.pathname.includes('/auth/callback'));
    
    // Don't redirect if we're already on callback page (avoid loop)
    if (window.location.pathname.includes('/auth/callback')) {
      console.log('⏸️ Already on callback page, waiting for callback to complete...');
      return
    }
    
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

