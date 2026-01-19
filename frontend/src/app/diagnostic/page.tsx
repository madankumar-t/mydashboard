'use client'

import { useEffect, useState } from 'react'
import { Box, Typography, Paper, List, ListItem, ListItemText } from '@mui/material'

export default function DiagnosticPage() {
    const [diagnostics, setDiagnostics] = useState<string[]>([])

    useEffect(() => {
        const logs: string[] = []

        // Check environment variables
        logs.push('=== Environment Variables ===')
        logs.push(`COGNITO_USER_POOL_ID: ${process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'MISSING'}`)
        logs.push(`COGNITO_CLIENT_ID: ${process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || 'MISSING'}`)
        logs.push(`COGNITO_REGION: ${process.env.NEXT_PUBLIC_COGNITO_REGION || 'MISSING'}`)
        logs.push(`COGNITO_DOMAIN: ${process.env.NEXT_PUBLIC_COGNITO_DOMAIN || 'MISSING'}`)
        logs.push(`API_URL: ${process.env.NEXT_PUBLIC_API_URL || 'MISSING'}`)
        logs.push('')

        // Check localStorage
        logs.push('=== LocalStorage ===')
        try {
            const session = localStorage.getItem('aws-inventory-session')
            if (session) {
                const parsed = JSON.parse(session)
                logs.push(`Session exists: YES`)
                logs.push(`Username: ${parsed.username}`)
                logs.push(`Expires: ${new Date(parsed.expiresAt).toISOString()}`)
                logs.push(`Expired: ${parsed.expiresAt < Date.now() ? 'YES' : 'NO'}`)
            } else {
                logs.push('No session found')
            }
        } catch (error) {
            logs.push(`Error reading session: ${error}`)
        }
        logs.push('')

        // Check URL
        logs.push('=== Current URL ===')
        logs.push(`Full URL: ${window.location.href}`)
        logs.push(`Origin: ${window.location.origin}`)
        logs.push(`Pathname: ${window.location.pathname}`)
        logs.push(`Search: ${window.location.search}`)
        logs.push('')

        // Check if we're coming from callback
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')

        if (code) {
            logs.push('=== Auth Callback Detected ===')
            logs.push(`Code: ${code.substring(0, 20)}...`)
        }

        if (error) {
            logs.push('=== Auth Error Detected ===')
            logs.push(`Error: ${error}`)
            logs.push(`Description: ${urlParams.get('error_description')}`)
        }

        setDiagnostics(logs)
    }, [])

    return (
        <Box p={4}>
            <Typography variant="h4" gutterBottom>
                Authentication Diagnostics
            </Typography>

            <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                    System Status
                </Typography>
                <List dense>
                    {diagnostics.map((log, index) => (
                        <ListItem key={index}>
                            <ListItemText
                                primary={log}
                                primaryTypographyProps={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                    color: log.includes('MISSING') ? 'error.main' :
                                        log.includes('===') ? 'primary.main' : 'text.primary'
                                }}
                            />
                        </ListItem>
                    ))}
                </List>
            </Paper>

            <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Browser Console
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Open the browser console (F12) to see detailed logs from the authentication flow.
                    Look for messages starting with 🔐, ✅, or ❌
                </Typography>
            </Paper>
        </Box>
    )
}
