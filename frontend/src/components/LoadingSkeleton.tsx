'use client'

import { Skeleton, Box, Card, CardContent, Grid } from '@mui/material'

interface LoadingSkeletonProps {
  variant?: 'table' | 'cards' | 'list'
  rows?: number
}

export default function LoadingSkeleton({ variant = 'table', rows = 5 }: LoadingSkeletonProps) {
  if (variant === 'cards') {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    )
  }

  if (variant === 'list') {
    return (
      <Box>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1 }} />
        ))}
      </Box>
    )
  }

  // Table variant (default)
  return (
    <Box>
      <Skeleton variant="rectangular" height={56} sx={{ mb: 1 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={52} sx={{ mb: 0.5 }} />
      ))}
    </Box>
  )
}

