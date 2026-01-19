'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { handleAuthCallback } from '@/lib/auth'
import { Box, CircularProgress, Typography, Alert } from '@mui/material'

function AuthCallbackContent() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const hasExchanged = useRef(false)

  useEffect(() => {
    console.log('🔐 AuthCallbackContent useEffect triggered')
    console.log('🔐 hasExchanged.current:', hasExchanged.current)
    
    // Prevent double execution in React Strict Mode
    if (hasExchanged.current) {
      console.log('⏸️ Already exchanged, skipping...')
      return
    }
    hasExchanged.current = true

    // Get params directly from window.location to avoid hydration issues
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const errorParam = urlParams.get('error')
    const errorDescription = urlParams.get('error_description')

    console.log('🔐 Auth Callback - Code received:', code ? 'YES' : 'NO')
    console.log('🔐 Auth Callback - Code value:', code ? code.substring(0, 20) + '...' : 'NONE')
    console.log('🔐 Auth Callback - Current URL:', window.location.href)
    console.log('🔐 Auth Callback - Search params:', window.location.search)

    if (errorParam) {
      console.error('❌ Auth Error:', errorParam, errorDescription)
      setError(errorDescription || errorParam)
      setLoading(false)
      return
    }

    if (!code) {
      console.error('❌ No authorization code in URL')
      setError('No authorization code received')
      setLoading(false)
      return
    }

    // Handle OAuth callback
    console.log('🔄 Starting token exchange...')
    console.log('🔄 Code to exchange:', code.substring(0, 20) + '...')
    
    // Add timeout to detect if token exchange hangs
    const exchangeTimeout = setTimeout(() => {
      console.error('⏱️ Token exchange timeout - taking too long')
      setError('Token exchange is taking too long. Please try again.')
      setLoading(false)
    }, 30000) // 30 second timeout
    
    handleAuthCallback(code)
      .then((session) => {
        clearTimeout(exchangeTimeout)
        console.log('✅ Token exchange successful!')
        console.log('✅ Token exchange successful!')
        console.log('✅ Username:', session.username)
        console.log('✅ Groups:', session.groups)
        // Store session
        if (typeof window !== 'undefined') {
          try {
            // Store in localStorage (required for static Next.js apps)
            localStorage.setItem('aws-inventory-session', JSON.stringify(session))
            console.log('✅ Session stored in localStorage')
            
            // Verify session was stored (critical check)
            const verifySession = localStorage.getItem('aws-inventory-session')
            if (!verifySession) {
              throw new Error('Failed to store session in localStorage - localStorage may be blocked')
            }
            
            // Parse and verify session structure
            const parsedSession = JSON.parse(verifySession)
            if (!parsedSession.idToken || !parsedSession.expiresAt) {
              throw new Error('Session stored but missing required fields')
            }
            
            console.log('✅ Session verified in localStorage:', {
              hasIdToken: !!parsedSession.idToken,
              hasAccessToken: !!parsedSession.accessToken,
              expiresAt: new Date(parsedSession.expiresAt).toISOString(),
              username: parsedSession.username
            })
            
            // Also verify localStorage is working
            try {
              localStorage.setItem('__test__', 'test')
              localStorage.removeItem('__test__')
              console.log('✅ localStorage is functional')
            } catch (storageTestError) {
              console.error('❌ localStorage test failed:', storageTestError)
              throw new Error('localStorage is not available or blocked by browser')
            }
            
            // Use longer delay to ensure session is fully written and dashboard can read it
            // Also use window.location for a hard redirect to avoid race conditions
            console.log('🔄 Waiting before redirect to ensure session is available...')
            setTimeout(() => {
              console.log('🔄 Redirecting to dashboard...')
              window.location.href = '/dashboard'
            }, 500) // Increased delay to 500ms
          } catch (storageError) {
            console.error('❌ Failed to store session:', storageError)
            setError('Failed to store authentication session. Please check browser settings.')
            setLoading(false)
          }
        } else {
          router.push('/dashboard')
        }
      })
      .catch((err: unknown) => {
        clearTimeout(exchangeTimeout)
        console.error('❌ Token exchange failed:', err)
        if (err instanceof Error) {
          console.error('❌ Error message:', err.message)
          console.error('❌ Error stack:', err.stack)
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to authenticate. Please try again.'
        console.error('❌ Setting error state:', errorMessage)
        setError(errorMessage)
        setLoading(false)
      })
  }, [router]) // Remove router from dependencies to ensure it runs once

  if (loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={2}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Completing authentication...
        </Typography>
      </Box>
    )
  }

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
            Authentication Failed
          </Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '10px 20px',
            marginTop: '16px',
            cursor: 'pointer',
          }}
        >
          Return to Login
        </button>
      </Box>
    )
  }

  return null
}

export default function AuthCallbackPage() {
  // Add logging to verify component is mounting
  console.log('🔐 AuthCallbackPage component rendering')
  
  // Remove Suspense to avoid hydration errors
  return <AuthCallbackContent />
}

