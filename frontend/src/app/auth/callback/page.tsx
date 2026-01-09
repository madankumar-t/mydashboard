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
    // Prevent double execution in React Strict Mode
    if (hasExchanged.current) return
    hasExchanged.current = true

    // Get params directly from window.location to avoid hydration issues
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const errorParam = urlParams.get('error')
    const errorDescription = urlParams.get('error_description')

    console.log('🔐 Auth Callback - Code received:', code ? 'YES' : 'NO')
    console.log('🔐 Auth Callback - Current URL:', window.location.href)

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
    handleAuthCallback(code)
      .then((session) => {
        console.log('✅ Token exchange successful!')
        console.log('✅ Username:', session.username)
        console.log('✅ Groups:', session.groups)
        // Store session
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('aws-inventory-session', JSON.stringify(session))
            console.log('✅ Session stored in localStorage')
            
            // Verify session was stored
            const verifySession = localStorage.getItem('aws-inventory-session')
            if (!verifySession) {
              throw new Error('Failed to store session in localStorage')
            }
            console.log('✅ Session verified in localStorage')
            
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
        console.error('❌ Token exchange failed:', err)
        if (err instanceof Error) {
          console.error('❌ Error message:', err.message)
          console.error('❌ Error stack:', err.stack)
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to authenticate. Please try again.'
        setError(errorMessage)
        setLoading(false)
      })
  }, [router])

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
  // Remove Suspense to avoid hydration errors
  return <AuthCallbackContent />
}

