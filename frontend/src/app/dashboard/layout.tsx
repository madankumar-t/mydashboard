'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredSession, logout } from '@/lib/auth'
import { AppBar, Toolbar, Typography, Button, Box, Avatar, CircularProgress } from '@mui/material'
import { ExitToApp, AccountCircle } from '@mui/icons-material'
import DashboardSidebar from '@/components/DashboardSidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    // Wait for client-side hydration
    setMounted(true)

    console.log('📊 Dashboard layout mounted, checking session...')

    // Add multiple checks with increasing delays to handle race conditions
    // This is especially important when coming from callback redirect
    const checkSession = (attempt = 1) => {
      console.log(`📊 Checking session (attempt ${attempt})...`)
      const stored = getStoredSession()
      
      if (stored) {
        console.log('✅ Session found:', {
          username: stored.username,
          expiresAt: new Date(stored.expiresAt).toISOString(),
          now: new Date().toISOString(),
          valid: stored.expiresAt > Date.now()
        })
      } else {
        console.warn('⚠️ No session found')
      }
      
      // Add 5 minute buffer before expiration to avoid edge cases
      const expirationBuffer = 5 * 60 * 1000 // 5 minutes in milliseconds
      if (!stored || (stored.expiresAt && stored.expiresAt <= Date.now() + expirationBuffer)) {
        // If this is the first few attempts, wait longer (might be race condition from callback)
        if (attempt < 3) {
          console.log(`⏳ Session not found yet (attempt ${attempt}), waiting longer...`)
          setTimeout(() => checkSession(attempt + 1), 300 * attempt) // 300ms, 600ms, 900ms
          return
        }
        
        console.warn('❌ No valid session found after multiple attempts, redirecting to login')
        // Clear any invalid session
        if (typeof window !== 'undefined') {
          localStorage.removeItem('aws-inventory-session')
        }
        router.push('/')
        return
      }
      
      console.log('✅ Valid session confirmed, setting session state')
      setSession(stored)
    }

    // Check immediately
    checkSession(1)
  }, [router])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  // Show loading state while checking session (instead of returning null)
  // This prevents flash and gives time for session to be available
  if (!mounted) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  // If no session after mounted, it will redirect in useEffect
  // Show loading while redirecting
  if (!session) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <DashboardSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" elevation={1}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              AWS Inventory Dashboard
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 32, height: 32 }}>
                <AccountCircle />
              </Avatar>
              <Typography variant="body2">{session.username}</Typography>
              <Button
                color="inherit"
                startIcon={<ExitToApp />}
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Box>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}

