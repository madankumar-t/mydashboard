'use client'

import { useEffect, useState } from 'react'
import { Grid, Card, CardContent, Typography, Box, CircularProgress, Alert } from '@mui/material'
import {
  Cloud,
  Storage,
  Dataset, // ✅ CHANGED: replaced Database with Dataset
  Security,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { ServiceType } from '@/types'
import { api } from '@/lib/api'

interface SummaryCardsProps {
  service: ServiceType
  accounts?: string[]
  regions?: string[]
}

interface SummaryData {
  total: number
  running?: number
  stopped?: number
  errors?: number
  securityIssues?: number
}

export default function SummaryCards({ service, accounts, regions }: SummaryCardsProps) {
  const [summary, setSummary] = useState<SummaryData>({
    total: 0,
    running: 0,
    stopped: 0,
    errors: 0,
    securityIssues: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    loadSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, accounts, regions])

  const loadSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getSummary(service, accounts, regions)
      setSummary({
        total: data.total || 0,
        running: data.running ?? 0,
        stopped: data.stopped ?? 0,
        errors: data.errors ?? 0,
        securityIssues: data.securityIssues ?? 0,
      })
    } catch (err: unknown) {
      console.error('Failed to load summary:', err)
      let error: Error
      if (err instanceof Error) {
        error = err
      } else {
        const errorMessage = typeof err === 'string' ? err : String(err) || 'Failed to load summary'
        error = new Error(errorMessage)
      }
      setError(error)
      // Reset to defaults on error
      setSummary({
        total: 0,
        running: 0,
        stopped: 0,
        errors: 0,
        securityIssues: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Unable to load summary statistics: {error.message}
      </Alert>
    )
  }

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Cloud color="primary" />
              <Box>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Resources
                </Typography>
                <Typography variant="h5">{summary.total}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {summary.running !== undefined && (
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <CheckCircle color="success" />
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Running
                  </Typography>
                  <Typography variant="h5">{summary.running}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      )}

      {summary.stopped !== undefined && (
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Warning color="warning" />
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Stopped
                  </Typography>
                  <Typography variant="h5">{summary.stopped}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      )}

      {summary.securityIssues !== undefined && summary.securityIssues > 0 && (
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <ErrorIcon color="error" />
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Security Issues
                  </Typography>
                  <Typography variant="h5" color="error">
                    {summary.securityIssues}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  )
}
